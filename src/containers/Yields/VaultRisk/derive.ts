// Pure transforms: raw fixture → view-model. No React, fully unit-testable. All dollar
// magnitude maths exclude non-computed losses (a data_gap is never a complete figure).

import type { BlockExplorersResponse } from '~/api/types'
import { humanizeDuration } from './format'
import type { Tone } from './kindMeta'
import { coverageAppliesToScenario } from './policy'
import { applicableCoverageUsd, dedupeCoverage, pickWorst } from './stats'
import { tokenIconByAddress } from './tokenIcon'
import type {
	ActingWindowVM,
	AnchorLossVM,
	CollateralRisk,
	CollateralVM,
	CoverageVM,
	ExitReadinessVM,
	HeadlineVM,
	MarketOracle,
	OracleConfigEntry,
	PerAssetLossVM,
	ProtocolRiskFixture,
	RealizedIncident,
	RealizedIncidentVM,
	RiskLoss,
	ScenarioVM,
	TokenRef,
	VaultRiskData,
	VaultRiskFixture,
	VaultRiskVM,
	VaultScenario
} from './types'

// The scenario the backend fans per non-market-oracle collateral: a conditional worst case
// pairing the drainable-now floor (min_usd) with the whole-position ceiling (max_usd), plus
// the feed's controlling admin(s) as the plausibility signal.
export const ORACLE_FULL_DRAIN_SCENARIO_ID = 'oracle-compromise-full-drain'

export function parseActingWindow(loss: Pick<RiskLoss, 'window_type' | 'time_window_sec'>): ActingWindowVM {
	const { min, max } = loss.time_window_sec
	if (loss.window_type === 'event') {
		return {
			kind: 'no-escape',
			label: 'No time to exit',
			minSec: min,
			maxSec: max
		}
	}
	const label =
		min === max
			? `${humanizeDuration(min)} withdraw window`
			: `${humanizeDuration(min)} – ${humanizeDuration(max)} withdraw window`
	return { kind: 'window', label, minSec: min, maxSec: max }
}

// status precedence within a fanned group: computed → data_gap → not_attributable → no_loss
function groupStatus(rows: Array<VaultScenario>): RiskLoss['status'] {
	if (rows.some((r) => r.loss.status === 'computed')) return 'computed'
	if (rows.some((r) => r.loss.status === 'data_gap')) return 'data_gap'
	if (rows.some((r) => r.loss.status === 'not_attributable')) return 'not_attributable'
	return 'no_loss'
}

function oracleConfigByAddress(oracleConfig: Array<OracleConfigEntry>): Map<string, OracleConfigEntry> {
	const m = new Map<string, OracleConfigEntry>()
	for (const o of oracleConfig) {
		if (o.asset_address) m.set(o.asset_address.toLowerCase(), o)
	}
	return m
}

// One representative market oracle per collateral, backfilling oracle-explanation fields
// when oracle_config lacks them; prefer entries that actually carry an explanation.
function isExplained(mo: MarketOracle): boolean {
	return !!(mo.mechanism_summary || mo.legs?.length)
}
function marketOracleByCollateral(markets: Array<MarketOracle>): Map<string, MarketOracle> {
	const m = new Map<string, MarketOracle>()
	for (const mo of markets) {
		const addr = mo.collateral_asset?.address?.toLowerCase()
		if (!addr) continue
		const existing = m.get(addr)
		if (!existing || (!isExplained(existing) && isExplained(mo))) m.set(addr, mo)
	}
	return m
}

interface BuildScenariosDeps {
	realizedByScenario: Map<string, RealizedIncident>
	coverageVMs: Array<CoverageVM>
	oracleByAddr: Map<string, OracleConfigEntry>
}

// computed first (by lossMaxUsd desc), then data_gap, then no_loss
const STATUS_RANK: Record<RiskLoss['status'], number> = {
	computed: 0,
	data_gap: 1,
	not_attributable: 2,
	no_loss: 3
}

function compareScenarios(a: ScenarioVM, b: ScenarioVM): number {
	if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
	return b.lossMaxUsd - a.lossMaxUsd
}

export function buildScenarios(vault: VaultRiskFixture, deps: BuildScenariosDeps): Array<ScenarioVM> {
	// group by scenario_id, preserving first-seen order
	const groups = new Map<string, Array<VaultScenario>>()
	for (const s of vault.vault_specific_risks) {
		const arr = groups.get(s.scenario_id)
		if (arr) arr.push(s)
		else groups.set(s.scenario_id, [s])
	}

	const out: Array<ScenarioVM> = []
	for (const [scenarioId, rows] of groups) {
		const head = rows[0]!
		const status = rows.length === 1 ? head.loss.status : groupStatus(rows)
		// magnitude only sums computed rows
		const computedRows = rows.filter((r) => r.loss.status === 'computed')
		const lossMaxUsd = computedRows.reduce((a, r) => a + (r.loss.max_usd || 0), 0)
		const lossMinUsd = computedRows.reduce((a, r) => a + (r.loss.min_usd || 0), 0)

		// Sum the served per-drop curve across this scenario's markets. Absent → the row is
		// drop-independent and the table's stress toggle skips it.
		let lossByAnchor: Array<AnchorLossVM> | undefined
		if (computedRows.some((r) => r.loss.by_anchor?.length)) {
			const byDrop = new Map<number, number>()
			for (const r of computedRows) {
				for (const a of r.loss.by_anchor ?? []) {
					byDrop.set(a.drop_pct, (byDrop.get(a.drop_pct) ?? 0) + (a.loss_usd || 0))
				}
			}
			lossByAnchor = [...byDrop.entries()]
				.map(([dropPct, lossUsd]) => ({ dropPct, lossUsd }))
				.sort((a, b) => a.dropPct - b.dropPct)
		}

		let perAsset: Array<PerAssetLossVM> | undefined
		// full-drain is a per-collateral story (drainable-now vs full-compromise, plus the feed's
		// controlling admin) — break it out even when a single collateral is affected.
		const fanned = rows.some((r) => r.asset)
		if (fanned && (rows.length > 1 || scenarioId === ORACLE_FULL_DRAIN_SCENARIO_ID)) {
			perAsset = rows
				.filter((r): r is VaultScenario & { asset: TokenRef } => !!r.asset)
				.map((r) => {
					const oc = deps.oracleByAddr.get(r.asset.address.toLowerCase())
					const computed = r.loss.status === 'computed'
					return {
						symbol: r.asset.symbol,
						address: r.asset.address,
						lossMaxUsd: computed ? r.loss.max_usd || 0 : 0,
						lossMinUsd: computed ? r.loss.min_usd || 0 : 0,
						...(oc ? { oracleType: oc.type } : {}),
						...(oc?.heartbeat_sec !== undefined ? { heartbeatSec: oc.heartbeat_sec } : {}),
						...(oc?.deviation_threshold !== undefined ? { deviationThreshold: oc.deviation_threshold } : {}),
						...(r.oracle_admins ? { oracleAdmins: r.oracle_admins } : {})
					}
				})
				.sort((a, b) => b.lossMaxUsd - a.lossMaxUsd)
		}

		out.push({
			scenarioId,
			kind: head.kind,
			title: head.title ?? scenarioId,
			oneLiner: head.description,
			status,
			lossMinUsd,
			lossMaxUsd,
			...(lossByAnchor ? { lossByAnchor } : {}),
			magnitudePct: 0, // filled in after sectionMax known
			actingWindow: parseActingWindow(head.loss),
			...(perAsset ? { perAsset } : {}),
			conditions: head.conditions,
			mitigations: [...new Set(head.mitigations ?? [])],
			evidence: head.evidence ?? [],
			inputs: head.loss.inputs ?? {},
			...(head.loss.formula ? { formula: head.loss.formula } : {}),
			...(head.loss.notes ? { notes: head.loss.notes } : {}),
			...(deps.realizedByScenario.has(scenarioId) ? { realized: deps.realizedByScenario.get(scenarioId)! } : {}),
			coverage: coverageForScenario(deps.coverageVMs, scenarioId)
		})
	}

	out.sort(compareScenarios)
	return out
}

function computeSectionMaxUsd(scenarios: Array<ScenarioVM>, collateral: Array<CollateralVM>): number {
	let max = 0
	for (const s of scenarios) if (s.status === 'computed' && s.lossMaxUsd > max) max = s.lossMaxUsd
	for (const c of collateral) {
		const lossUsd = collateralMarketBreakLossUsd(c)
		if (lossUsd > max) max = lossUsd
	}
	return max > 0 ? max : 1
}

export function mergeCoverage(vault: VaultRiskFixture, protocol: ProtocolRiskFixture | null): Array<CoverageVM> {
	return dedupeCoverage([...(vault.coverage ?? []), ...(protocol?.coverage ?? [])])
}

// Same policy as the headline total (committed + names the scenario), so the scenario row
// and the verdict never disagree.
export function coverageForScenario(coverage: Array<CoverageVM>, scenarioId: string): Array<CoverageVM> {
	return coverage.filter((c) => coverageAppliesToScenario(c, scenarioId))
}

export function buildCollateral(vault: VaultRiskFixture, explorers?: BlockExplorersResponse): Array<CollateralVM> {
	const oracleByAddr = oracleConfigByAddress(vault.oracle_config ?? [])
	const marketByAddr = marketOracleByCollateral(vault.market_oracles ?? [])
	const supplyUsd = vault.pool_total_supply_usd
	const list: Array<CollateralVM> = (vault.collateral_risks ?? []).map((c: CollateralRisk) => {
		const oc = oracleByAddr.get(c.token.address.toLowerCase())
		const mo = marketByAddr.get(c.token.address.toLowerCase())
		const exposureUsd = c.exposure_usd || 0
		const ptPricing = oc?.pt_pricing ?? mo?.pt_pricing ?? null
		// oracle_config (curated, per-asset) wins; the collateral's market oracle is the fallback.
		const oracleMechanism = oc?.mechanism_summary ?? mo?.mechanism_summary ?? null
		const oracleBaseLeg = oc?.base_leg ?? mo?.base_leg ?? null
		const oracleQuoteLeg = oc?.quote_leg ?? mo?.quote_leg ?? null
		const oracleLegs = oc?.legs?.length ? oc.legs : mo?.legs?.length ? mo.legs : null
		return {
			symbol: c.token.symbol,
			address: c.token.address,
			chain: c.token.chain,
			logoUrl: tokenIconByAddress(explorers, c.token.chain, c.token.address),
			oracleType: c.oracle_type,
			exposureUsd,
			allocationUsd: c.vault_allocation_usd ?? null,
			marketLossCeilingUsd: c.market_loss_ceiling_usd || 0,
			supplyCapUsd: c.supply_cap_usd ?? null,
			liquidationThreshold: c.liquidation_threshold ?? null,
			borrowedDebtUsd: c.collateral_borrowed_debt_usd ?? null,
			badDebtAtZeroUsd: c.bad_debt_at_price_zero_usd ?? null,
			badDebtBasis: c.bad_debt_basis ?? null,
			badDebtMarkets: (c.bad_debt_markets ?? []).map((m) => ({
				lltv: m.lltv ?? null,
				badDebtAtZeroUsd: m.bad_debt_at_zero_usd
			})),
			drainableUsd: c.drainable_usd ?? null,
			aggregateTrustUsd: c.aggregate_trust_usd || 0,
			vaultCount: c.vault_count || 0,
			// prefer the server figure; fall back to exposure / TVL so the bar always has a value
			exposurePct:
				c.exposure_pct != null ? c.exposure_pct : supplyUsd != null && supplyUsd > 0 ? exposureUsd / supplyUsd : null,
			vaultMarketShare: c.vault_market_share ?? null,
			oracleProviders: c.oracle_providers ?? [],
			oracleAddresses: c.oracle_addresses ?? [],
			feedKinds: c.feed_kinds ?? [],
			oracleMechanism,
			oracleBaseLeg,
			oracleQuoteLeg,
			oracleLegs,
			ptPricing,
			magnitudePct: 0,
			...(oc ? { oracleConfig: oc } : {})
		}
	})
	// Rank by the depositor-facing market-break loss; position cap and ceiling break ties.
	return list.sort(
		(a, b) =>
			collateralMarketBreakLossUsd(b) - collateralMarketBreakLossUsd(a) ||
			b.exposureUsd - a.exposureUsd ||
			b.marketLossCeilingUsd - a.marketLossCeilingUsd
	)
}

function normalisedDrop(drop: number): number {
	return Math.min(1, Math.max(0, drop))
}

type BadDebtMarketInputs = { lltv: number | null; badDebtAtZeroUsd: number }

function badDebtAtDrop(debtUsd: number, liquidationThreshold: number, drop: number, capAtZeroUsd: number): number {
	const x = normalisedDrop(drop)
	if (liquidationThreshold <= 0) return capAtZeroUsd
	return Math.min(debtUsd * Math.max(0, 1 - (1 - x) / liquidationThreshold), capAtZeroUsd)
}

function badDebtAtDropMarkets(markets: Array<BadDebtMarketInputs>, drop: number): number {
	return markets.reduce(
		(sum, m) =>
			sum +
			(m.lltv != null && m.lltv > 0
				? badDebtAtDrop(m.badDebtAtZeroUsd, m.lltv, drop, m.badDebtAtZeroUsd)
				: m.badDebtAtZeroUsd),
		0
	)
}

// Mirrors vault-risk-adapters `computeStress`: missing bad-debt attribution excludes the row,
// per-market LLTVs win over the single fallback, allocation is the defensive loss cap.
type DepegInputs = Pick<
	CollateralVM,
	'liquidationThreshold' | 'borrowedDebtUsd' | 'badDebtAtZeroUsd' | 'badDebtMarkets' | 'allocationUsd'
>

export function isCollateralStressModelable(c: Pick<CollateralVM, 'badDebtAtZeroUsd'>): boolean {
	return c.badDebtAtZeroUsd != null
}

export function collateralDepegLossUsd(c: DepegInputs, drop: number): number {
	if (c.badDebtAtZeroUsd == null) return 0
	const alloc = c.allocationUsd ?? Number.POSITIVE_INFINITY
	const rawLoss =
		c.badDebtMarkets.length > 0
			? badDebtAtDropMarkets(c.badDebtMarkets, drop)
			: c.borrowedDebtUsd != null && c.liquidationThreshold != null
				? badDebtAtDrop(c.borrowedDebtUsd, c.liquidationThreshold, drop, c.badDebtAtZeroUsd)
				: c.badDebtAtZeroUsd
	return Math.min(rawLoss, alloc)
}

// Row headline: all-to-zero bad debt when attributable, else the exposure cap. Oracle-
// compromise drain is a separate attack path and must not be added to this number.
export function collateralMarketBreakLossUsd(c: DepegInputs & Pick<CollateralVM, 'exposureUsd'>): number {
	return isCollateralStressModelable(c) ? collateralDepegLossUsd(c, 1) : c.exposureUsd
}

// How the "if this market breaks" bad debt is PRESENTED, keyed on bad_debt_basis: modeled
// (precise or ≈ market-wide), a confident $0, or unmodeled (exposure shown only as a ceiling).
export type MarketBreakPresentation =
	| { kind: 'modeled'; usd: number; approximate: boolean }
	| { kind: 'confident-zero' }
	| { kind: 'unmodeled'; ceilingUsd: number }

type PresentationInputs = DepegInputs & Pick<CollateralVM, 'exposureUsd' | 'badDebtBasis'>

export function marketBreakPresentation(c: PresentationInputs): MarketBreakPresentation {
	// An unmodeled figure (explicit basis or legacy null) must never be dressed up as a
	// precise loss — show the position cap as a ceiling instead.
	if (c.badDebtBasis === 'unmodeled' || !isCollateralStressModelable(c))
		return { kind: 'unmodeled', ceilingUsd: c.exposureUsd }
	const usd = collateralMarketBreakLossUsd(c)
	if (usd <= 0) return { kind: 'confident-zero' }
	return { kind: 'modeled', usd, approximate: c.badDebtBasis === 'market-wide' }
}

// A collateral with every shown figure under $1 — summarized as a count instead of a wall of
// $0 rows. Display-only: risk totals still use the full collateral set.
export const COLLATERAL_DUST_USD = 1
export function isDustCollateral(c: CollateralVM): boolean {
	return (
		collateralMarketBreakLossUsd(c) < COLLATERAL_DUST_USD &&
		(c.allocationUsd ?? 0) < COLLATERAL_DUST_USD &&
		(c.drainableUsd ?? 0) < COLLATERAL_DUST_USD
	)
}

// The VAULT's own bad debt at a uniform price drop, summed across modelable collateral.
export function vaultDepegLossUsd(collateral: Array<DepegInputs>, drop: number): number {
	return collateral.reduce((sum, c) => sum + collateralDepegLossUsd(c, drop), 0)
}

// The VAULT's own bad debt when each collateral can use a different drop, e.g.
// cbBTC −30%, wstETH 0%, cbETH −10% in the custom-by-asset UI mode.
export function vaultDepegLossUsdAtDrops<T extends DepegInputs>(
	collateral: Array<T>,
	dropForCollateral: (c: T) => number
): number {
	return collateral.reduce((sum, c) => sum + collateralDepegLossUsd(c, dropForCollateral(c)), 0)
}

export function buildHeadline(
	scenarios: Array<ScenarioVM>,
	collateral: Array<CollateralVM>,
	coverage: Array<CoverageVM>
): HeadlineVM {
	const computed = scenarios.filter((s) => s.status === 'computed')
	// Worst-case tie-breaks live in stats.ts: biggest loss, then no-escape, then least-covered.
	const worstPick = pickWorst(
		computed.map((s) => ({
			scenarioId: s.scenarioId,
			lossMaxUsd: s.lossMaxUsd,
			noEscape: s.actingWindow.kind === 'no-escape'
		})),
		coverage
	)
	const worst = worstPick ? (computed.find((s) => s.scenarioId === worstPick.scenarioId) ?? null) : null
	const noEscape = computed
		.filter((s) => s.actingWindow.kind === 'no-escape')
		.reduce<ScenarioVM | null>((best, s) => (!best || s.lossMaxUsd > best.lossMaxUsd ? s : best), null)

	// Headline coverage is scoped to the worst-case scenario: a layer only counts when the
	// worst case is among the scenarios it backs.
	const worstScenarioId = worst?.scenarioId ?? null
	const coverageTotalUsd = applicableCoverageUsd(coverage, worstScenarioId)
	const worstCaseMaxUsd = worst?.lossMaxUsd ?? 0
	const aggregateTrustUsd = collateral.reduce((a, c) => Math.max(a, c.aggregateTrustUsd), 0)

	return {
		worstCaseMaxUsd,
		worstCaseTitle: worst?.title ?? null,
		worstCaseScenarioId: worstScenarioId,
		worstCaseWindow: worst?.actingWindow ?? null,
		largestNoEscapeUsd: noEscape?.lossMaxUsd ?? 0,
		largestNoEscapeTitle: noEscape?.title ?? null,
		coverageTotalUsd,
		worstCaseCovered: worstCaseMaxUsd > 0 && coverageTotalUsd >= worstCaseMaxUsd,
		uncoveredMaxUsd: Math.max(0, worstCaseMaxUsd - coverageTotalUsd),
		aggregateTrustUsd
	}
}

function buildExitReadiness(vault: VaultRiskFixture, scenarios: Array<ScenarioVM>): ExitReadinessVM {
	const computed = scenarios.filter((s) => s.status === 'computed')
	const worstNoEscape = computed
		.filter((s) => s.actingWindow.kind === 'no-escape')
		.reduce<ScenarioVM | null>((best, s) => (!best || s.lossMaxUsd > best.lossMaxUsd ? s : best), null)
	const bestExit = scenarios
		.filter((s) => s.actingWindow.kind === 'window')
		.reduce<ScenarioVM | null>(
			(best, s) => (!best || s.actingWindow.maxSec > best.actingWindow.maxSec ? s : best),
			null
		)
	return {
		poolType: vault.pool_type,
		availableLiquidityUsd: vault.available_liquidity_usd,
		utilization: vault.utilization,
		worstNoEscape: worstNoEscape?.actingWindow ?? null,
		bestExitWindow: bestExit?.actingWindow ?? null
	}
}

export interface RefResolution {
	label: string
	url?: string
	anchor?: boolean // true → in-page anchor to the oracle table
}

export function resolveRef(ref: string, protocol: ProtocolRiskFixture | null): RefResolution {
	if (ref === 'oracle_config') return { label: 'Oracle config', anchor: true }
	const deps = protocol?.external_dependencies ?? []
	// external_dependencies.<id-or-name>
	if (ref.startsWith('external_dependencies.')) {
		const key = ref.slice('external_dependencies.'.length)
		const dep = deps.find((d) => d.id === key || d.name === key)
		if (dep) return { label: dep.name || dep.id, ...(dep.source_url ? { url: dep.source_url } : {}) }
		return { label: key }
	}
	// stable-id rule: exact id, or `<id>.<aspect>` — ids may themselves contain dots
	// (resolves chainlink.multisig, chainlink.node-operator-set, l2.sequencer, ...)
	const dep = deps.find((d) => ref === d.id || ref.startsWith(`${d.id}.`))
	if (dep) {
		const aspect = ref.length > dep.id.length ? ref.slice(dep.id.length + 1) : ''
		const name = dep.name || dep.id
		return {
			label: aspect ? `${name} · ${aspect}` : name,
			...(dep.source_url ? { url: dep.source_url } : {})
		}
	}
	return { label: ref }
}

export function scenarioTone(s: ScenarioVM): Tone {
	if (s.status === 'no_loss') return 'good'
	if (s.status === 'data_gap') return 'muted'
	return s.actingWindow.kind === 'no-escape' ? 'danger' : 'warning'
}

// Top-level assembly: the one function the section calls. `explorers` only feeds token
// icon resolution (chain name → evm chain id); everything else derives from `data`.
export function buildVaultRiskVM(data: VaultRiskData, explorers?: BlockExplorersResponse): VaultRiskVM {
	const { vault, protocol } = data
	const coverageVMs = mergeCoverage(vault, protocol)
	const realizedByScenario = new Map<string, RealizedIncident>()
	for (const r of vault.realized_incidents ?? []) realizedByScenario.set(r.scenario_id, r)
	const oracleByAddr = oracleConfigByAddress(vault.oracle_config ?? [])

	const scenarios = buildScenarios(vault, {
		realizedByScenario,
		coverageVMs,
		oracleByAddr
	})
	const collateral = buildCollateral(vault, explorers)

	// Pool-level track record only; protocol-wide history lives on `protocol.incidents`.
	const realizedIncidents: Array<RealizedIncidentVM> = (vault.realized_incidents ?? []).flatMap((r) =>
		(r.incidents ?? []).map((i) => ({
			date: i.date,
			usdLost: i.usd_lost,
			usdRecovered: i.usd_recovered ?? null,
			...(i.post_mortem_url ? { postMortemUrl: i.post_mortem_url } : {}),
			title: r.title ?? r.scenario_id
		}))
	)

	// Depositor cap: you can't lose more than the pool holds. Market-wide ceilings can exceed
	// supply — clamp and keep the raw figure for context.
	const supplyUsd = vault.pool_total_supply_usd
	if (supplyUsd != null && supplyUsd > 0) {
		for (const s of scenarios) {
			if (s.status === 'computed' && s.lossMaxUsd > supplyUsd) {
				s.rawLossMaxUsd = s.lossMaxUsd
				s.cappedAtSupply = true
				s.lossMaxUsd = supplyUsd
				s.lossMinUsd = Math.min(s.lossMinUsd, supplyUsd)
			}
		}
		// re-sort: caps can change the ranking
		scenarios.sort(compareScenarios)
	}

	const sectionMax = computeSectionMaxUsd(scenarios, collateral)

	for (const s of scenarios) s.magnitudePct = s.status === 'computed' ? s.lossMaxUsd / sectionMax : 0
	for (const c of collateral) c.magnitudePct = collateralMarketBreakLossUsd(c) / sectionMax

	return {
		protocolId: vault.protocol_id,
		chain: vault.chain,
		poolType: vault.pool_type,
		vaultName: vault.vault_name ?? null,
		vaultAddress: vault.vault_address ?? null,
		supplyUsd,
		allocatedUsd: vault.allocated_usd ?? null,
		idleUsd: vault.idle_usd ?? null,
		vaultRoles: vault.vault_roles ?? null,
		headline: buildHeadline(scenarios, collateral, coverageVMs),
		riskTier: vault.risk_tier ?? null,
		exitReadiness: buildExitReadiness(vault, scenarios),
		scenarios,
		collateral,
		coverage: coverageVMs,
		realizedIncidents,
		stress: vault.stress ?? null,
		marketOracles: vault.market_oracles ?? [],
		oracleDependencies: vault.oracle_dependencies ?? [],
		oracleExposure: vault.oracle_exposure ?? null,
		vaultExternalDependencies: vault.external_dependencies ?? [],
		freshness: vault.freshness,
		lastUpdatedTs: vault.last_updated_ts ?? null,
		stale: vault.stale ?? false,
		protocolFreshness: protocol?.freshness ?? null,
		protocol
	}
}

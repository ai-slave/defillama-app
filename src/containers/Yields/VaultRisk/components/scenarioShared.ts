import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { formatLossRange } from '../format'
import type { ScenarioVM } from '../types'

export function isFullLoss(s: ScenarioVM, supplyUsd: number | null): boolean {
	return Boolean(s.cappedAtSupply) || (supplyUsd != null && supplyUsd > 0 && s.lossMaxUsd >= supplyUsd * 0.995)
}

// Sub-1% keeps "<1%" so a thin tail never rounds to a dishonest "0%"; ≥99.5% reads "100%".
export function formatDepositPct(share: number): string {
	const pct = share * 100
	if (pct <= 0) return '0%'
	if (pct >= 99.5) return '100%'
	if (pct < 1) return '<1%'
	return formatPercent(pct, { input: 'percent', maximumFractionDigits: 0 })
}

// A modeled loss as a share of the deposit — the primary unit for every loss on this page.
// Position-independent by construction: your loss scales pro-rata with your slice, so the
// percentage is the same whether you deposited $1k or the whole pool. Null when there's no
// denominator to divide by, which is the caller's cue to fall back to dollars.
export function lossPct(lossUsd: number, supplyUsd: number | null): string | null {
	if (supplyUsd == null || supplyUsd <= 0) return null
	return formatDepositPct(Math.min(1, lossUsd / supplyUsd))
}

// Percent when we can, dollars when we can't — used for every modeled-loss figure.
function lossAmount(lossUsd: number, supplyUsd: number | null): string {
	return (
		lossPct(lossUsd, supplyUsd) ??
		formatUsd(lossUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	)
}

// An explicit modeled zero ("buffered"), distinct from a missing figure ("—").
function zeroAmount(supplyUsd: number | null): string {
	return supplyUsd != null && supplyUsd > 0 ? '0%' : '$0'
}

// Your loss = pool loss × your pro-rata share, capped at 1 (you can't lose more than you
// deposited). Pool-wide figure unchanged when no position is set.
export function scaleToPosition(poolUsd: number, supplyUsd: number | null, position: number | null): number {
	if (position == null || supplyUsd == null || supplyUsd <= 0) return poolUsd
	return poolUsd * Math.min(1, position / supplyUsd)
}

// Whether a scenario has any expandable detail content — gates row clickability.
export function scenarioHasDetail(s: ScenarioVM): boolean {
	return Boolean(
		s.oneLiner ||
		s.conditions ||
		s.mitigations.length > 0 ||
		s.evidence.length > 0 ||
		s.perAsset?.length ||
		s.realized ||
		s.coverage.length > 0 ||
		Object.keys(s.inputs).length > 0
	)
}

// The scenarios the table actually renders (excludes `no_loss`). The tab badge and the
// table's rows both derive from this, so they can never disagree.
export function isDisplayedScenario(s: ScenarioVM): boolean {
	return s.status === 'computed' || s.status === 'data_gap' || s.status === 'not_attributable'
}

// Identified but not yet sizeable — rendered as "Not quantified" rather than a dollar figure.
export function isUnquantified(s: ScenarioVM): boolean {
	return s.status === 'data_gap' || s.status === 'not_attributable'
}

export function dropPct(scenario: ScenarioVM): number | null {
	const v = scenario.inputs.drop_pct
	return typeof v === 'number' ? v : null
}

export interface ModeledLossCell {
	amount: string // % of deposit when there's a denominator, else dollars
	note: string | null
	sortUsd: number
	zero?: boolean // an explicit modeled zero (buffered), not a missing figure
}

// A drop anchor (10/30/50) re-prices every price-driven row to its served loss at that
// drop; 'worst' shows the all-to-zero ceiling.
export type StressSel = 10 | 30 | 50 | 'worst'

// Drop-agnostic cell — never implies a stress drop the scenario wasn't modeled with.
function baseModeledCell(scenario: ScenarioVM, supplyUsd: number | null): ModeledLossCell {
	const drop = dropPct(scenario)
	const min = scenario.lossMinUsd
	const max = scenario.lossMaxUsd

	if (drop != null) {
		if (min <= 0) {
			return {
				amount: zeroAmount(supplyUsd),
				note: `Buffered at −${formatPercent(drop, { input: 'percent' })}`,
				sortUsd: 0,
				zero: true
			}
		}
		return {
			amount: lossAmount(min, supplyUsd),
			note: `At −${formatPercent(drop, { input: 'percent' })} stress`,
			sortUsd: min
		}
	}

	if (min === max && min > 0) {
		return { amount: lossAmount(min, supplyUsd), note: null, sortUsd: min }
	}

	if (min <= 0 && max > 0) {
		return { amount: '—', note: 'Worst case only', sortUsd: 0 }
	}

	if (min > 0) {
		return { amount: lossAmount(min, supplyUsd), note: null, sortUsd: min }
	}

	return { amount: '—', note: null, sortUsd: 0 }
}

// With `stress` set, price-driven rows re-price to the served loss at that anchor; rows
// with no drop dimension stay fixed. `supplyUsd` is the percentage denominator — omit it
// (or pass 0) and every figure degrades to dollars.
export function modeledLossCell(
	scenario: ScenarioVM,
	stress?: StressSel,
	supplyUsd: number | null = null
): ModeledLossCell {
	if (scenario.status !== 'computed') {
		return { amount: formatLossRange({ status: scenario.status, min_usd: 0, max_usd: 0 }), note: null, sortUsd: 0 }
	}

	if (stress == null) return baseModeledCell(scenario, supplyUsd)

	// Price-driven: read the served curve (pure renderer — the backend computed each anchor).
	if (scenario.lossByAnchor?.length) {
		if (stress === 'worst') {
			const max = scenario.lossMaxUsd
			return { amount: lossAmount(max, supplyUsd), note: null, sortUsd: max }
		}
		const v = scenario.lossByAnchor.find((a) => a.dropPct === stress)?.lossUsd ?? 0
		// Zero at this drop = the drop sits inside the liquidation margin.
		if (v <= 0) return { amount: zeroAmount(supplyUsd), note: 'Inside liquidation buffer', sortUsd: 0, zero: true }
		return { amount: lossAmount(v, supplyUsd), note: null, sortUsd: v }
	}

	// No drop dimension under an active stress selector: fixed at every anchor, but 'worst' still
	// means the ceiling — a min<max row (e.g. oracle full-drain) must never show its floor under a
	// worst-case header. (Kept from upstream.)
	if (stress === 'worst' && scenario.lossMaxUsd > 0) {
		return { amount: lossAmount(scenario.lossMaxUsd, supplyUsd), note: null, sortUsd: scenario.lossMaxUsd }
	}
	return { ...baseModeledCell(scenario, supplyUsd), note: null }
}

// Title for the selected-stress loss — consistent between table header and detail hero.
export function stressLossTitle(s: ScenarioVM, stress?: StressSel): string {
	if (s.lossByAnchor?.length && stress != null) {
		return stress === 'worst' ? 'Worst-case loss' : `Loss at −${formatPercent(stress, { input: 'percent' })}`
	}
	const drop = dropPct(s)
	return drop != null ? `Loss at −${formatPercent(drop, { input: 'percent' })}` : 'Modeled loss'
}

// Presentation-only grouping derived from kind + scenario_id + status; never changes any
// risk math. First match wins.
export type ScenarioGroupKey =
	| 'full-deposit'
	| 'price-driven'
	| 'oracle-liquidation'
	| 'vault-allocator'
	| 'not-quantified'

// Vault-scoped privileged actors — checked first so they leave the protocol/oracle buckets.
const VAULT_ALLOCATOR_IDS = new Set([
	'vault-role-capture-risk-expansion',
	'vault-curator-fee-extraction',
	'vault-allocator-liquidity-mismanagement',
	'public-allocator-misuse'
])

export function scenarioGroup(s: ScenarioVM): ScenarioGroupKey {
	if (s.status === 'data_gap' || s.status === 'not_attributable') return 'not-quantified'
	if (VAULT_ALLOCATOR_IDS.has(s.scenarioId)) return 'vault-allocator'
	switch (s.kind) {
		case 'macro':
			return 'price-driven'
		case 'oracle-malfunction':
		case 'oracle-hack':
		case 'liquidity':
			return 'oracle-liquidation'
		default: // smart-contract, bridge, governance, multisig
			return 'full-deposit'
	}
}

export const SCENARIO_GROUPS: Array<{ key: ScenarioGroupKey; label: string; blurb: string }> = [
	{
		key: 'full-deposit',
		label: 'Full-deposit & protocol-level',
		blurb: 'Protocol-wide failures that can take the whole deposit.'
	},
	{ key: 'price-driven', label: 'Price-driven collateral stress', blurb: 'Loss scales with how far collateral falls.' },
	{
		key: 'oracle-liquidation',
		label: 'Oracle & liquidation failures',
		blurb: 'A pricing or liquidation safeguard misfires.'
	},
	{
		key: 'vault-allocator',
		label: 'Vault role & allocator',
		blurb: 'A privileged vault actor acting against depositors.'
	},
	{
		key: 'not-quantified',
		label: 'Not quantified',
		blurb: "Identified, but onchain inputs can't size the impact yet."
	}
]

// Position-independent: the ceiling as a share of the deposit, so it reads the same for
// every depositor in the pool.
export function worstCaseLabel(scenario: ScenarioVM, supplyUsd: number | null): string {
	if (scenario.status !== 'computed') return formatLossRange({ status: scenario.status, min_usd: 0, max_usd: 0 })
	if (isFullLoss(scenario, supplyUsd)) return 'Full deposit'
	const amount = lossAmount(scenario.lossMaxUsd, supplyUsd)
	if (scenario.lossMinUsd === scenario.lossMaxUsd) return amount
	return `up to ${amount}`
}

export function scenarioRowId(scenarioId: string): string {
	return `scenario-${scenarioId}`
}

export function scrollToScenarioRow(scenarioId: string) {
	requestAnimationFrame(() => {
		document.getElementById(scenarioRowId(scenarioId))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
	})
}

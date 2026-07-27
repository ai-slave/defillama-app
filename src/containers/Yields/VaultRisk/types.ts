// Two layers: raw fixture types mirror the risk API JSON exactly; derived view-model (VM)
// types are the pure output of derive.ts — components never touch raw shapes.

/* ────────────────────────────── raw fixture types ────────────────────────────── */

// Open set — known values get bespoke icons/labels in kindMeta; the rest fall back.
export type RiskKind =
	| 'governance'
	| 'multisig'
	| 'oracle-hack'
	| 'oracle-malfunction'
	| 'smart-contract'
	| 'bridge'
	| 'liquidity'
	| 'macro'
	| (string & {})

export type OracleType = 'market' | 'aum' | 'hardcoded' | 'hybrid' | 'unknown' | (string & {})

// How a Pendle PT is priced. Absent on non-PT assets; widenable.
export type PtPricing = 'linear_discount' | 'market_rate' | 'managed' | 'custom' | (string & {})

// How the backend derived a collateral's bad-debt figure — governs presentation precision.
// `unmodeled` ⇒ no figure (never render $0); absent on un-migrated protocols (legacy behaviour).
export type BadDebtBasis = 'position-scan' | 'market-wide' | 'unmodeled' | (string & {})

export type LossStatus = 'computed' | 'no_loss' | 'data_gap' | 'not_attributable'

// `event` = the attack's own duration → no escape. `exit` = a guaranteed withdraw window.
export type WindowType = 'event' | 'exit'

export type CoverageKind = 'umbrella' | 'treasury' | 'insurance-protocol' | 'comet-reserves' | (string & {})
export type CoverageAccess = 'instant' | 'gov_vote' | 'discretionary' | (string & {})
export type PoolType = 'vault' | 'market'

// Relative 3-band rank recomputed across every vault each run; intentionally no numeric score.
export type RiskBand = 'lower' | 'moderate' | 'higher'

export interface RiskFact {
	label: string
	polarity: 'good' | 'caution'
}

export interface RiskTier {
	tier: RiskBand // the band to display
	relative_band: RiskBand // raw rank before red-flag capping (transparency only)
	capped_by: string[] // why tier < relative_band; [] = not capped
	facts: RiskFact[] // ≤5; ordered caveats → good → caution. These ARE the explanation.
	limited_data: boolean
}

// Precomputed depeg stress: vault bad debt at fixed drop anchors (no liquidations).
export interface StressByCollateral {
	symbol: string
	address: string
	bad_debt_usd: number
}

export interface StressAnchor {
	drop_pct: number // 10, 30, 50
	bad_debt_usd: number
	by_collateral: StressByCollateral[] // sorted desc, only entries > 0
}

export interface Stress {
	anchors: StressAnchor[]
	ceiling_usd: number // all-collateral-to-zero — the 100% endpoint
}

export type OracleAttribution =
	| 'market_exact'
	| 'asset_fallback'
	| 'api_address_only'
	| 'same_asset_no_oracle'
	| 'zero_lltv_no_oracle'
	| 'unclassified'
	| (string & {})

// A resolved on-chain price-source leg: what it reads (`description`), who provides it
// (`vendor`), and `kind` — a live-market hop vs a NAV / exchange-rate / vault leg.
export type OracleLegSlot = 'base1' | 'base2' | 'quote1' | 'quote2' | 'base_vault' | 'quote_vault' | (string & {})
export type OracleLegKind = 'market' | 'exchange-rate' | 'nav' | 'vault' | (string & {})
export interface OracleLeg {
	slot: OracleLegSlot
	description: string
	vendor?: string
	kind: OracleLegKind
}

// One row per market the pool lends into — per-market oracle/LLTV/vendor mapping.
export interface MarketOracle {
	market_id: string
	collateral_asset: { symbol: string; address: string; chain: string } | null
	loan_asset: {
		symbol: string
		address: string
		chain: string
		decimals: number | null
		price_usd: number | null
	} | null
	allocation_usd: number | null // this vault's supplied position in the market
	supply_cap_usd: number | null
	lltv: number | null // market liquidation LLTV (0–1)
	oracle_address: string | null
	oracle_type: OracleType
	oracle_providers: string[] // proven vendor(s); [] = no third-party vendor
	feed_kind: string | null
	attribution: OracleAttribution
	oracle_instance: string | null
	api_oracle_type?: string | null // raw Morpho API label; provenance/debug only
	// Backend-resolved oracle explanation (sparse). `mechanism_summary` is preferred over any
	// copy derived from oracle_type/feed_kind; `pt_pricing` only on PT assets.
	mechanism_summary?: string
	base_leg?: string
	quote_leg?: string
	pt_pricing?: PtPricing
	// Resolved price-source legs; launch-set (base + ethereum) only — treat as optional.
	legs?: OracleLeg[]
}

// Vault-wide oracle exposure rollups. `by_provider` overlaps (a multi-vendor feed counts
// toward each) so it can exceed the total — never sum it.
export interface OracleExposureEntry {
	exposure_usd: number
	exposure_pct: number
	collateral_symbols: string[]
}

export interface OracleExposure {
	by_type: Array<OracleExposureEntry & { type: OracleType }>
	by_provider: Array<OracleExposureEntry & { provider: string }>
}

// The on-chain entity that controls the price feed(s), aggregated across dependent assets.
// Rows overlap (a feed with two admins counts toward each) — don't sum.
export interface OracleDependency {
	admin_address: string
	admin_kind: 'safe' | 'guardian-set' | 'contract' | 'eoa' | (string & {})
	multisig?: string // m-of-n for `safe`/`guardian-set`, e.g. "4/9"
	vendors: string[]
	collateral_symbols: string[] // the vault's assets priced through this admin
	exposure_usd: number // mispriceable if this admin is compromised
	exposure_pct: number | null // of vault TVL; can slightly exceed 1 via overlap → clamp on display
}

export interface TokenRef {
	chain: string
	symbol: string
	address: string
}

export interface RiskLoss {
	basis: 'manual' | 'derived' | (string & {})
	status: LossStatus
	inputs: Record<string, number>
	formula?: string
	notes?: string
	max_usd: number
	min_usd: number
	// Price-driven scenarios only: pro-rata modeled loss at each drop anchor (10/30/50).
	// Absent → drop-independent risk.
	by_anchor?: Array<{ drop_pct: number; loss_usd: number }>
	window_type: WindowType
	time_window_sec: { min: number; max: number }
}

export interface ConditionNode {
	op: 'and' | 'or' | 'leaf'
	description?: string
	ref?: string
	notes?: string
	children?: ConditionNode[]
}

export interface Evidence {
	url: string
	kind: string
	title?: string
	date?: string
	note?: string
}

// The on-chain entity that can move a feed, attached to oracle-compromise scenario rows.
// `threshold`/`signers` give the m-of-n of a Safe or guardian set — the governance-strength
// (how-hard-to-compromise) signal. A missing entry on a row means it wasn't resolved this
// tick, NOT that the feed is ungoverned.
export interface OracleAdmin {
	address: string
	kind: 'safe' | 'guardian-set' | 'contract' | 'eoa' | (string & {})
	threshold?: number
	signers?: number
}

export interface VaultScenario {
	id: string
	scenario_id: string
	kind: RiskKind
	title?: string // authored display title, served on every row; fall back to the slug only
	description: string
	asset?: TokenRef // present on fanned per-asset scenarios
	loss: RiskLoss
	conditions: ConditionNode
	mitigations: string[]
	evidence: Evidence[]
	probability_estimates: unknown[]
	oracle_admins?: OracleAdmin[] // oracle-compromise rows only; absent = unresolved this tick
}

export interface CollateralRisk {
	token: TokenRef
	market_loss_ceiling_usd: number // broad market-wide ceiling against this collateral
	vault_allocation_usd: number | null // the pool's own supplied position; null = feed unavailable
	exposure_usd: number // position cap: min(ceiling, allocation, vault TVL), server-computed
	supply_cap_usd?: number | null // forward-looking bound; null = uncapped or unknown
	// What-if depeg anchors: buffered while drop ≤ 1 − threshold, then interpolates linearly to
	// bad_debt_at_price_zero_usd. Threshold = the RISKIEST (highest) LLTV across markets.
	liquidation_threshold?: number | null // 0–1; null = not collateral / unknown
	collateral_borrowed_debt_usd?: number | null // debt currently drawn against this collateral
	bad_debt_at_price_zero_usd?: number | null // THIS vault's pro-rata bad-debt ceiling at −100%
	// How the figure was derived (see BadDebtBasis); `unmodeled` ⇒ figure is null.
	bad_debt_basis?: BadDebtBasis
	// Per-market breakdown — a collateral can span markets with different LLTVs.
	bad_debt_markets?: Array<{ lltv: number | null; bad_debt_at_zero_usd: number }>
	// Oracle-compromise loss: $ drainable by mispricing this collateral's feed.
	drainable_usd?: number | null
	aggregate_trust_usd: number // cross-protocol total; renders as "Aggregate Collateral Trust (ACT)"
	vault_count: number
	oracle_type: OracleType
	// Actual on-chain oracle contract(s). `['unverified']` = vendor not yet identified
	// (neutral, NOT high-risk); `[]` on a hardcoded oracle = no live feed.
	oracle_addresses?: string[]
	oracle_providers?: string[]
	feed_kinds?: string[]
	exposure_pct?: number // exposure_usd as a share of vault TVL (0–1)
	// Vault's 0–1 supply-share of this collateral's markets; null = not resolvable this tick.
	vault_market_share?: number | null
	token_listing_id: string | null
	// The public API may omit it — never read unguarded.
	liquidity_scenario?: VaultScenario
}

export interface RealizedIncident {
	scenario_id: string
	title?: string // authored scenario title, served next to the description
	description: string
	incidents: Array<{
		date: string
		usd_lost: number
		usd_recovered: number
		post_mortem_url?: string
	}>
}

export interface Coverage {
	kind: CoverageKind
	access: CoverageAccess
	source?: string
	cap_usd: number
	priority: number
	applies_to: string[] // scenario_ids this coverage backs
	access_time_sec: number | null
	description?: string
	cap_usd_excl_own_tokens?: number
}

export interface SourceAttribution {
	value: string
	source_url?: string
	verified_at?: string
	verified_by?: string
}

// A manually-curated, source-attributed value of any shape.
export interface ManualRef<T> {
	value: T
	source_url?: string
	verified_at?: string
	verified_by?: string
}

export interface OracleConfigEntry {
	type: OracleType
	chain: string
	instance: string
	asset_symbol: string
	asset_address: string
	oracle_address: string
	feed_kind?: string | null
	provider?: string[]
	heartbeat_sec?: number
	deviation_threshold?: number
	source_attribution?: SourceAttribution
	// Same frontend-ready explanation fields as MarketOracle (see there).
	mechanism_summary?: string
	base_leg?: string
	quote_leg?: string
	pt_pricing?: PtPricing
	legs?: OracleLeg[]
}

// `drift` and `stale` share this shape; a missing/empty array = none.
export interface DriftEntry {
	id: string
	kind: string
	notes: string
	actual: string
	expected: string
}

export interface Freshness {
	last_run: string
	sources: Array<{ kind: string; endpoint: string }>
	drift?: DriftEntry[]
	stale?: DriftEntry[]
}

// A queued, timelocked role action — the depositor's live window to exit before it lands.
export interface PendingChange {
	function_name: string // Morpho action, e.g. "SetCap" | "SetGuardian" | "SetTimelock"
	label?: string // authored plain-language label for what the change does
	valid_at: number // unix SECONDS the change becomes executable
}

// What kind of on-chain entity holds a role, classified each tick. `unknown` = the read
// failed this tick (neutral, NOT a flag).
export type RoleKind = 'safe' | 'contract' | 'eoa' | 'unknown' | (string & {})

export interface RoleEntity {
	address: string
	kind: RoleKind
	threshold?: { m: number; n: number } // present on `safe` → render "m-of-n multisig"
}

// Per-vault role registry. null registry = feed unavailable. The veto role is guardian OR
// sentinels (newer Morpho vaults) — never both; guardian null AND sentinels empty = nobody
// can cancel a malicious curator change during the timelock.
export interface VaultRoles {
	owner: RoleEntity | null
	curator: RoleEntity | null
	guardian: RoleEntity | null
	sentinels?: RoleEntity[] // veto-only safety role; several addresses may hold it
	pending_owner?: RoleEntity | null // non-null = ownership transfer in flight
	timelock_sec?: number | null // role-action exit window for depositors
	allocators?: RoleEntity[]
	pending_changes?: PendingChange[] // [] = nothing queued; sorted soonest-first
}

export interface VaultRiskFixture {
	yield_pool_id: string
	protocol_id: string
	chain: string
	pool_type: PoolType
	vault_name?: string | null
	vault_address?: string | null
	vault_roles?: VaultRoles | null
	pool_total_supply_usd: number
	pool_total_borrow_usd: number // 0 on vaults is CORRECT (vaults don't borrow)
	available_liquidity_usd: number | null // markets only; null on vaults
	utilization: number | null // markets only; null on vaults
	allocated_usd?: number | null // vaults only; unallocated = supply − this
	idle_usd?: number | null // vaults only (0 = known-empty, null = unavailable)
	vault_specific_risks: VaultScenario[]
	collateral_risks: CollateralRisk[]
	realized_incidents: RealizedIncident[]
	coverage: Coverage[]
	oracle_config: OracleConfigEntry[]
	freshness: Freshness
	risk_tier?: RiskTier
	stress?: Stress
	market_oracles?: MarketOracle[]
	oracle_exposure?: OracleExposure
	oracle_dependencies?: OracleDependency[]
	external_dependencies?: ExternalDependency[] // scoped to this vault + relevance-tagged
	last_updated_ts?: number // unix SECONDS of the tick that produced this row
	stale?: boolean // true = not refreshed in its protocol's latest run (last-known-good)
}

export interface AuditFinding {
	high: number | null
	critical: number | null
	resolved: number | null
}

export interface Audit {
	date: string
	firm: string
	scope?: string
	report?: SourceAttribution
	version?: string
	findings: AuditFinding
	commit_hash?: string | null
	findings_status?: string
	matches_deployed?: boolean | null
}

// The protection between an actor and your funds: 'vault-timelock' = exit window;
// 'instant' = no window; 'veto-only' = can only cancel; 'none' = no depositor-facing lever.
export type DepositorGate = 'vault-timelock' | 'instant' | 'veto-only' | 'none' | (string & {})

export interface DepositorImpact {
	reaches_principal: boolean
	gate: DepositorGate
	summary: ManualRef<string> // the plain "how can this screw me?" answer
}

export interface Multisig {
	kind: string
	role?: string // generic role tag; per-chain rows share one role and group by it
	role_label?: string // authored display label for the role; the slug stays the join key
	chain: string
	address: string
	powers?: SourceAttribution
	signers: Array<{ address: string }>
	threshold: { m: number; n: number }
	depositor_impact?: DepositorImpact
}

// What each vault role can DO to a depositor — joined to `vault_roles` by `role`.
export interface RoleCapability {
	role: string
	role_label?: string // authored display label for the role
	reaches_principal: boolean
	gate: DepositorGate
	summary: string
	source_url?: string
}

// Either null, a plain string, or a sourced attribution whose `value` may itself be a
// string or an {address, description} object.
export type GuardianRole =
	| string
	| {
			value: string | { address?: string; description?: string }
			source_url?: string
			verified_at?: string
			verified_by?: string
	  }

export interface Governance {
	chain: string
	contract: string
	quorum_min?: number
	quorum_max?: number
	voting_token?: { chain: string; symbol: string; address: string }
	guardian_role: GuardianRole | null
	execution_delay_min_sec: number
	execution_delay_max_sec: number
	voting_power_concentration_top10_pct: number
	voting_power_top10_tokens?: number | null // whole tokens; null = power unreadable
	top10_clears_quorum?: boolean | null // server-computed, unit-aware
	// `reaches_existing_deposits: false` = governance can't touch live deposits (e.g. Morpho).
	depositor_blast_radius?: ManualRef<{ reaches_existing_deposits: boolean; summary: string }> | null
}

// `principal` can affect your deposit; `governance`/`rewards`/`ui` are context only.
// Absent on the protocol-level (unscoped) list.
export type DependencyRelevance = 'principal' | 'governance' | 'rewards' | 'ui'

export interface ExternalDependency {
	id: string
	kind: string
	name: string
	source_url?: string
	description?: string
	notes?: string
	verified_at?: string
	relevance?: DependencyRelevance
	applies_to_chains?: string[]
	requires_feature?: 'public-allocator' | 'pre-liquidation' | (string & {})
}

// `protocol` = the core itself; `ecosystem` = app/tooling around it; `collateral` = a
// curator's collateral choice. None are a given vault's own realized loss.
export type IncidentClassification = 'protocol' | 'ecosystem' | 'collateral' | (string & {})

// Protocol-wide incident history. Distinct from `vault.realized_incidents` (per-vault) —
// never sum the two.
export interface ProtocolIncident {
	date: string
	kind: string
	classification: IncidentClassification
	chain?: string
	technique?: string
	usd_lost: number
	usd_recovered: number
	fully_recovered?: boolean
	post_mortem_url?: string
	root_cause_still_possible?: string
	notes?: string
}

export interface ProtocolRiskFixture {
	protocol_id: string
	audits: Audit[]
	incidents?: ProtocolIncident[]
	coverage: Coverage[]
	multisigs: Multisig[]
	governance: Governance
	role_capabilities?: RoleCapability[]
	external_dependencies?: ExternalDependency[]
	// Protocols the aggregate_trust_usd sums over — generate labels from this, never hardcode.
	aggregate_trust_scope?: string[]
	freshness: Freshness
}

export interface VaultRiskData {
	vault: VaultRiskFixture
	protocol: ProtocolRiskFixture | null
}

/* ────────────────────────────── derived view-model types ────────────────────────────── */

export interface ActingWindowVM {
	kind: 'no-escape' | 'window'
	label: string // "No time to exit" | "1–7 day withdraw window"
	minSec: number
	maxSec: number
}

export interface PerAssetLossVM {
	symbol: string
	address: string
	lossMaxUsd: number
	lossMinUsd?: number // full-drain: what's drainable right now (the borrow-out floor)
	oracleType?: OracleType
	heartbeatSec?: number
	deviationThreshold?: number
	oracleAdmins?: OracleAdmin[] // controllers of this collateral's feed (full-drain rows)
}

export interface AnchorLossVM {
	dropPct: number // 10 | 30 | 50
	lossUsd: number
}

export interface ScenarioVM {
	scenarioId: string
	kind: RiskKind
	title: string
	oneLiner: string
	status: LossStatus
	lossMinUsd: number
	lossMaxUsd: number // depositor-facing, capped at pool supply
	lossByAnchor?: AnchorLossVM[] // per-drop loss curve; price-driven scenarios only
	rawLossMaxUsd?: number // the uncapped market-wide ceiling, when it exceeded supply
	cappedAtSupply?: boolean
	magnitudePct: number // lossMaxUsd / sectionMaxUsd, 0 for non-computed
	actingWindow: ActingWindowVM
	perAsset?: PerAssetLossVM[] // grouped fanned scenarios
	conditions: ConditionNode
	mitigations: string[]
	evidence: Evidence[]
	inputs: Record<string, number>
	formula?: string
	notes?: string // the pipeline's own methodology caveats — always surfaced
	realized?: RealizedIncident // matched by scenario_id
	coverage: CoverageVM[]
}

export interface CoverageVM {
	kind: CoverageKind
	access: CoverageAccess
	capUsd: number // cap_usd_excl_own_tokens ?? cap_usd
	rawCapUsd: number
	excludesOwnTokens: boolean
	accessTimeSec: number | null
	appliesTo: string[]
	description?: string
	priority: number
}

export interface CollateralVM {
	symbol: string
	address: string
	chain: string // the token's chain — explorer links resolve against this, never a default
	logoUrl: string | null
	oracleType: OracleType
	exposureUsd: number // position cap: min(ceiling, allocation, vault TVL), server-computed
	allocationUsd: number | null
	marketLossCeilingUsd: number
	supplyCapUsd: number | null
	liquidationThreshold: number | null // riskiest (highest) LLTV across markets; 0–1
	borrowedDebtUsd: number | null
	badDebtAtZeroUsd: number | null // THIS vault's pro-rata bad-debt ceiling at −100%
	badDebtBasis: BadDebtBasis | null // null = un-migrated protocol (legacy behaviour)
	badDebtMarkets: Array<{ lltv: number | null; badDebtAtZeroUsd: number }>
	drainableUsd: number | null // oracle-compromise loss
	aggregateTrustUsd: number
	vaultCount: number
	exposurePct: number // exposureUsd / vault TVL (0–1)
	// Provenance/context only. Served losses are ALREADY vault pro-rata; never re-multiply.
	vaultMarketShare: number | null
	oracleProviders: string[] // proven vendor(s); ['unverified'] = neutral; [] = no live feed
	oracleAddresses: string[]
	feedKinds: string[]
	// Backend-resolved oracle explanation; all null when not yet derived.
	oracleMechanism: string | null // preferred over derived copy
	oracleBaseLeg: string | null
	oracleQuoteLeg: string | null
	oracleLegs: OracleLeg[] | null // richest breakdown; null → fall back to base/quote
	ptPricing: PtPricing | null // null = not a PT (or unresolved)
	magnitudePct: number
	oracleConfig?: OracleConfigEntry
}

// Sourced straight from `realized_incidents` (independent of the scenario list) so a
// suppressed forward-looking scenario can never erase real history.
export interface RealizedIncidentVM {
	date: string
	usdLost: number
	usdRecovered: number
	postMortemUrl?: string
	title: string
}

export interface HeadlineVM {
	worstCaseMaxUsd: number
	worstCaseTitle: string | null
	worstCaseScenarioId: string | null
	worstCaseWindow: ActingWindowVM | null
	largestNoEscapeUsd: number
	largestNoEscapeTitle: string | null
	coverageTotalUsd: number
	worstCaseCovered: boolean
	uncoveredMaxUsd: number
	aggregateTrustUsd: number
}

export interface ExitReadinessVM {
	poolType: PoolType
	availableLiquidityUsd: number | null // markets only
	utilization: number | null // markets only
	worstNoEscape: ActingWindowVM | null
	bestExitWindow: ActingWindowVM | null
}

// The full computed view-model the section renders from.
export interface VaultRiskVM {
	protocolId: string
	chain: string
	poolType: PoolType
	vaultName: string | null // display title = vaultName ?? the pool's symbol name
	vaultAddress: string | null
	supplyUsd: number
	allocatedUsd: number | null
	idleUsd: number | null
	vaultRoles: VaultRoles | null
	headline: HeadlineVM
	riskTier: RiskTier | null
	exitReadiness: ExitReadinessVM
	scenarios: ScenarioVM[]
	collateral: CollateralVM[]
	coverage: CoverageVM[]
	realizedIncidents: RealizedIncidentVM[]
	stress: Stress | null
	marketOracles: MarketOracle[]
	oracleDependencies: OracleDependency[]
	oracleExposure: OracleExposure | null
	vaultExternalDependencies: ExternalDependency[]
	freshness: Freshness
	lastUpdatedTs: number | null
	stale: boolean
	protocolFreshness: Freshness | null
	protocol: ProtocolRiskFixture | null
}

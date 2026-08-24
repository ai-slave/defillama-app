// Raw DTO aliases mirror the generated vault-risk serving contract. Derived view-model
// types below are the pure output of derive.ts; components never touch raw shapes.

import type * as Api from './apiTypes'

export type { VaultRiskListItem } from './apiTypes'

/* ────────────────────────────── raw API types ────────────────────────────── */

export type VaultRiskFixture = Api.VaultRiskResponse
export type ProtocolRiskFixture = Api.ProtocolRiskResponse
export type RiskKind = Api.RiskKind
export type OracleType = Api.OracleType
export type PtPricing = Api.OraclePtPricing
export type BadDebtBasis = NonNullable<VaultRiskFixture['collateral_risks'][number]['bad_debt_basis']>
export type LossStatus = VaultRiskFixture['vault_specific_risks'][number]['loss']['status']
export type WindowType = VaultRiskFixture['vault_specific_risks'][number]['loss']['window_type']
export type CoverageKind = VaultRiskFixture['coverage'][number]['kind']
export type CoverageAccess = VaultRiskFixture['coverage'][number]['access']
export type PoolType = VaultRiskFixture['pool_type']
export type RiskBand = Api.RiskBand
export type RiskFact = Api.RiskFact
export type RiskTier = Api.PoolRiskTier
export type Stress = VaultRiskFixture['stress']
export type StressAnchor = Stress['anchors'][number]
export type StressByCollateral = StressAnchor['by_collateral'][number]
export type OracleAttribution = VaultRiskFixture['market_oracles'][number]['attribution']
export type OracleLegSlot = Api.OracleLegSlot
export type OracleLegKind = Api.OracleLegKind
export type OracleLeg = Api.OracleLeg
export type MarketOracle = VaultRiskFixture['market_oracles'][number]
export type OracleExposure = VaultRiskFixture['oracle_exposure']
export type OracleExposureEntry = Omit<OracleExposure['by_provider'][number], 'provider'>
export type OracleDependency = VaultRiskFixture['oracle_dependencies'][number]
export type VaultScenario = VaultRiskFixture['vault_specific_risks'][number]
export type TokenRef = NonNullable<VaultScenario['asset']>
export type RiskLoss = VaultScenario['loss']
export type ConditionNode = Api.ConditionTree
export type Evidence = Api.Evidence
export type OracleAdmin = Api.OracleAdmin
export type CollateralRisk = VaultRiskFixture['collateral_risks'][number]
export type RealizedIncident = VaultRiskFixture['realized_incidents'][number]
export type Coverage = VaultRiskFixture['coverage'][number]
export type OracleConfigEntry = VaultRiskFixture['oracle_config'][number]
export type DriftEntry = Api.DriftEntry
export type Freshness = Api.FreshnessMetadata
export type PendingChange = Api.PendingChange
export type RoleKind = Api.RoleEntity['kind']
export type RoleEntity = Api.RoleEntity
export type VaultRoles = NonNullable<VaultRiskFixture['vault_roles']>
export type Audit = ProtocolRiskFixture['audits'][number]
export type AuditFinding = Audit['findings']
export type Multisig = ProtocolRiskFixture['multisigs'][number]
export type DepositorImpact = NonNullable<Multisig['depositor_impact']>
export type RoleCapability = Api.RoleCapability
export type Governance = ProtocolRiskFixture['governance']
export type GuardianRole = Governance['guardian_role']
export type ExternalDependency = VaultRiskFixture['external_dependencies'][number]
export type DependencyRelevance = ExternalDependency['relevance']
export type ProtocolIncident = Api.ProtocolIncident
export type IncidentClassification = ProtocolIncident['classification']
export type SourceAttribution = { value: string }
export type ManualRef<T> = { value: T }

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
	exposurePct: number | null // exposureUsd / vault TVL (0–1)
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
	usdRecovered: number | null
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
	supplyUsd: number | null
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

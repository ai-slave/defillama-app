// Typed builders for VaultRisk test data: each returns a minimal-valid object and shallow-
// merges `overrides`. Nested objects are rebuilt per call — no shared mutable defaults.

import type {
	Audit,
	CollateralRisk,
	ConditionNode,
	Coverage,
	Freshness,
	Governance,
	Multisig,
	ProtocolRiskFixture,
	RiskLoss,
	RoleEntity,
	Stress,
	StressAnchor,
	VaultRiskData,
	VaultRiskFixture,
	VaultRoles,
	VaultScenario
} from '../types'

export const makeFreshness = (o: Partial<Freshness> = {}): Freshness => ({
	last_run: '2026-01-01T00:00:00Z',
	sources: [],
	...o
})

export const makeCondition = (o: Partial<ConditionNode> = {}): ConditionNode => ({
	op: 'leaf',
	description: 'condition',
	...o
})

export const makeLoss = (o: Partial<RiskLoss> = {}): RiskLoss => ({
	basis: 'derived',
	status: 'computed',
	inputs: {},
	max_usd: 0,
	min_usd: 0,
	window_type: 'exit',
	time_window_sec: { min: 86_400, max: 604_800 },
	...o
})

export const makeScenario = (o: Partial<VaultScenario> = {}): VaultScenario => ({
	id: 'sc-1',
	scenario_id: 'scenario-1',
	kind: 'smart-contract',
	description: 'A representative failure scenario.',
	loss: makeLoss(o.loss),
	conditions: makeCondition(),
	mitigations: [],
	evidence: [],
	probability_estimates: [],
	...o
})

export const makeCollateral = (o: Partial<CollateralRisk> = {}): CollateralRisk => ({
	token: { chain: 'ethereum', symbol: 'TOK', address: '0x0000000000000000000000000000000000000000' },
	market_loss_ceiling_usd: 0,
	vault_allocation_usd: null,
	exposure_usd: 0,
	aggregate_trust_usd: 0,
	vault_count: 0,
	oracle_type: 'market',
	token_listing_id: null,
	...o
})

export const makeCoverage = (o: Partial<Coverage> = {}): Coverage => ({
	kind: 'treasury',
	access: 'instant',
	cap_usd: 0,
	priority: 0,
	applies_to: [],
	access_time_sec: null,
	...o
})

export const makeStressAnchor = (o: Partial<StressAnchor> = {}): StressAnchor => ({
	drop_pct: 30,
	bad_debt_usd: 0,
	by_collateral: [],
	...o
})

export const makeStress = (o: Partial<Stress> = {}): Stress => ({
	anchors: [],
	ceiling_usd: 0,
	...o
})

export const makeRoleEntity = (o: Partial<RoleEntity> = {}): RoleEntity => ({
	address: '0x0000000000000000000000000000000000000001',
	kind: 'contract',
	...o
})

export const makeVaultRoles = (o: Partial<VaultRoles> = {}): VaultRoles => ({
	owner: null,
	curator: null,
	guardian: null,
	...o
})

export const makeGovernance = (o: Partial<Governance> = {}): Governance => ({
	chain: 'ethereum',
	contract: '0x00000000000000000000000000000000000060a1',
	guardian_role: null,
	execution_delay_min_sec: 0,
	execution_delay_max_sec: 0,
	voting_power_concentration_top10_pct: 0,
	...o
})

export const makeMultisig = (o: Partial<Multisig> = {}): Multisig => ({
	kind: 'gnosis-safe',
	chain: 'ethereum',
	address: '0x0000000000000000000000000000000000005219',
	signers: [],
	threshold: { m: 1, n: 1 },
	...o
})

export const makeAudit = (o: Partial<Audit> = {}): Audit => ({
	date: '2024-01-01',
	firm: 'Audit Firm',
	findings: { high: null, critical: null, resolved: null },
	...o
})

export const makeVaultRiskFixture = (o: Partial<VaultRiskFixture> = {}): VaultRiskFixture => ({
	yield_pool_id: 'pool-1',
	protocol_id: 'protocol-1',
	chain: 'ethereum',
	pool_type: 'vault',
	pool_total_supply_usd: 1_000_000,
	pool_total_borrow_usd: 0,
	available_liquidity_usd: null,
	utilization: null,
	vault_specific_risks: [],
	collateral_risks: [],
	realized_incidents: [],
	coverage: [],
	oracle_config: [],
	freshness: makeFreshness(o.freshness),
	...o
})

export const makeProtocolRiskFixture = (o: Partial<ProtocolRiskFixture> = {}): ProtocolRiskFixture => ({
	protocol_id: 'protocol-1',
	audits: [],
	coverage: [],
	multisigs: [],
	governance: makeGovernance(o.governance),
	freshness: makeFreshness(o.freshness),
	...o
})

// The paired input to `buildVaultRiskVM`. Pass `protocol: null` to model the no-protocol case.
export const makeVaultRiskData = (
	vault: Partial<VaultRiskFixture> = {},
	protocol: Partial<ProtocolRiskFixture> | null = {}
): VaultRiskData => ({
	vault: makeVaultRiskFixture(vault),
	protocol: protocol === null ? null : makeProtocolRiskFixture(protocol)
})

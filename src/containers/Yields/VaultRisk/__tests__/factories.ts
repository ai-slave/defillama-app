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

export const makeCondition = (
	o: Partial<Extract<ConditionNode, { op: 'leaf' }>> = {}
): Extract<ConditionNode, { op: 'leaf' }> => ({
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
	title: 'Representative failure',
	kind: 'smart-contract',
	description: 'A representative failure scenario.',
	loss: makeLoss(o.loss),
	conditions: makeCondition(),
	mitigations: [],
	evidence: [],
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
	oracle_addresses: [],
	oracle_providers: [],
	token_listing_id: null,
	liquidation_threshold: null,
	collateral_borrowed_debt_usd: null,
	bad_debt_at_price_zero_usd: null,
	vault_market_share: null,
	exposure_pct: null,
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
	sentinels: [],
	pending_owner: null,
	timelock_sec: null,
	allocators: [],
	pending_changes: [],
	...o
})

export const makeGovernance = (o: Partial<Governance> = {}): Governance => ({
	chain: 'ethereum',
	contract: '0x00000000000000000000000000000000000060a1',
	guardian_role: null,
	depositor_blast_radius: null,
	voting_token: {
		chain: 'ethereum',
		symbol: 'GOV',
		address: '0x00000000000000000000000000000000000060a2'
	},
	execution_delay_min_sec: 0,
	execution_delay_max_sec: 0,
	quorum_min: 0,
	quorum_max: 0,
	voting_power_top10_tokens: null,
	top10_clears_quorum: null,
	voting_power_concentration_top10_pct: 0,
	...o
})

export const makeMultisig = (o: Partial<Multisig> = {}): Multisig => ({
	kind: 'safe',
	chain: 'ethereum',
	address: '0x0000000000000000000000000000000000005219',
	role: 'owner',
	role_label: 'Owner',
	powers: { value: 'Administer the protocol' },
	signers: [],
	threshold: { m: 1, n: 1 },
	...o
})

export const makeAudit = (o: Partial<Audit> = {}): Audit => ({
	date: '2024-01-01',
	firm: 'Audit Firm',
	report: { value: 'https://example.com/audit' },
	scope: 'Protocol contracts',
	version: '1.0',
	commit_hash: null,
	findings: { high: null, critical: null, resolved: null },
	findings_status: 'ok',
	matches_deployed: null,
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
	market_oracles: [],
	oracle_dependencies: [],
	oracle_exposure: { by_provider: [] },
	stress: makeStress(),
	external_dependencies: [],
	freshness: makeFreshness(o.freshness),
	risk_tier: {
		tier: 'lower',
		relative_band: 'lower',
		capped_by: [],
		facts: [],
		limited_data: false
	},
	last_updated_ts: 1_767_225_600,
	stale: false,
	retired: false,
	retired_reason: null,
	...o
})

export const makeProtocolRiskFixture = (o: Partial<ProtocolRiskFixture> = {}): ProtocolRiskFixture => ({
	protocol_id: 'protocol-1',
	audits: [],
	coverage: [],
	multisigs: [],
	governance: makeGovernance(o.governance),
	external_dependencies: [],
	role_capabilities: [],
	incidents: [],
	aggregate_trust_scope: [],
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

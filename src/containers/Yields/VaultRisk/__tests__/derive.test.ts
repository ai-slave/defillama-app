import { describe, expect, test } from 'vitest'
import { anyHasAnchors } from '../components/scenarioShared'
import {
	buildCollateral,
	buildScenarios,
	buildVaultRiskVM,
	collateralDepegLossUsd,
	collateralMarketBreakLossUsd,
	coverageForScenario,
	marketBreakPresentation,
	mergeCoverage,
	parseActingWindow,
	resolveRef,
	vaultDepegLossUsd,
	vaultDepegLossUsdAtDrops
} from '../derive'
import type { CollateralRisk, MarketOracle, OracleConfigEntry, OracleType, VaultRiskFixture } from '../types'
import {
	makeCollateral,
	makeCoverage,
	makeGovernance,
	makeLoss,
	makeProtocolRiskFixture,
	makeRoleEntity,
	makeScenario,
	makeStress,
	makeStressAnchor,
	makeVaultRiskData,
	makeVaultRiskFixture,
	makeVaultRoles
} from './factories'

// buildScenarios' dependency bag isn't exported; the three fields are all it reads.
const scenarioDeps = () => ({ realizedByScenario: new Map(), coverageVMs: [], oracleByAddr: new Map() }) as never

describe('parseActingWindow', () => {
	test('event → no-escape regardless of seconds', () => {
		expect(parseActingWindow({ window_type: 'event', time_window_sec: { min: 0, max: 86_400 } })).toMatchObject({
			kind: 'no-escape'
		})
	})
	test('exit → withdraw window with humanized label', () => {
		const w = parseActingWindow({ window_type: 'exit', time_window_sec: { min: 86_400, max: 604_800 } })
		expect(w.kind).toBe('window')
		expect(w.label).toContain('1 day')
		expect(w.label).toContain('7 days')
	})
})

describe('buildScenarios (grouping + status)', () => {
	// A vault whose oracle scenario is fanned across two assets (one scenario_id, two rows),
	// plus a data_gap and a no_loss row so grouping, per-asset rollup and status ordering are
	// all exercised at once.
	const fannedVault = () =>
		makeVaultRiskFixture({
			vault_specific_risks: [
				makeScenario({
					id: 'oc-wbtc',
					scenario_id: 'market-oracle-compromise',
					kind: 'oracle-hack',
					asset: { chain: 'ethereum', symbol: 'WBTC', address: '0xa1' },
					loss: makeLoss({ status: 'computed', max_usd: 300, min_usd: 300 })
				}),
				makeScenario({
					id: 'oc-weth',
					scenario_id: 'market-oracle-compromise',
					kind: 'oracle-hack',
					asset: { chain: 'ethereum', symbol: 'WETH', address: '0xa2' },
					loss: makeLoss({ status: 'computed', max_usd: 100, min_usd: 100 })
				}),
				makeScenario({
					id: 'stale',
					scenario_id: 'oracle-staleness',
					loss: makeLoss({ status: 'data_gap', max_usd: 0, min_usd: 0 })
				}),
				makeScenario({
					id: 'outage',
					scenario_id: 'api-indexer-outage',
					loss: makeLoss({ status: 'no_loss', max_usd: 0, min_usd: 0 })
				})
			]
		})

	test('collapses fanned per-asset scenarios into one row per scenario_id with perAsset breakdown', () => {
		const v = fannedVault()
		const scenarios = buildScenarios(v, scenarioDeps())
		const distinctIds = new Set(v.vault_specific_risks.map((s) => s.scenario_id))
		expect(scenarios.length).toBe(distinctIds.size)
		expect(scenarios.length).toBeLessThan(v.vault_specific_risks.length)
		const oracle = scenarios.find((s) => s.scenarioId === 'market-oracle-compromise')
		expect(oracle?.perAsset?.length ?? 0).toBeGreaterThan(1)
		// perAsset sorted desc by loss
		const losses = oracle!.perAsset!.map((p) => p.lossMaxUsd)
		expect([...losses].sort((a, b) => b - a)).toEqual(losses)
	})

	test('aggregates grouped magnitude as the sum of computed per-asset max_usd', () => {
		const v = fannedVault()
		const scenarios = buildScenarios(v, scenarioDeps())
		const oracle = scenarios.find((s) => s.scenarioId === 'market-oracle-compromise')!
		// 300 + 100 across the two computed rows sharing the scenario_id
		expect(oracle.lossMaxUsd).toBeCloseTo(400, 2)
	})

	test('sorts computed first, then data_gap, then no_loss', () => {
		// Served in the opposite order, so the result depends on the sort.
		const v = makeVaultRiskFixture({
			vault_specific_risks: [
				makeScenario({ id: 'outage', scenario_id: 'outage', loss: makeLoss({ status: 'no_loss' }) }),
				makeScenario({ id: 'stale', scenario_id: 'stale', loss: makeLoss({ status: 'data_gap' }) }),
				makeScenario({ id: 'bug', scenario_id: 'bug', loss: makeLoss({ status: 'computed', max_usd: 10 }) })
			]
		})
		expect(buildScenarios(v, scenarioDeps()).map((s) => s.status)).toEqual(['computed', 'data_gap', 'no_loss'])
	})

	test('matches realized incidents by scenario_id', () => {
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				vault_specific_risks: [
					makeScenario({ scenario_id: 'smart-contract-bug', loss: makeLoss({ status: 'computed', max_usd: 500 }) })
				],
				realized_incidents: [
					{
						scenario_id: 'smart-contract-bug',
						title: 'Smart contract bug',
						description: 'A past exploit',
						incidents: [{ date: '2023-05-01', usd_lost: 1000, usd_recovered: 0 }]
					}
				]
			})
		)
		const withRealized = vm.scenarios.filter((s) => s.realized)
		expect(withRealized.length).toBeGreaterThanOrEqual(1)
		expect(withRealized[0]!.realized!.incidents.length).toBeGreaterThan(0)
	})
})

describe('buildScenarios — oracle full-drain (per-collateral, min/max range + admins)', () => {
	const fullDrainVault = (oracleAdmins?: unknown) =>
		makeVaultRiskFixture({
			vault_specific_risks: [
				makeScenario({
					id: 'fd-prime',
					scenario_id: 'oracle-compromise-full-drain',
					kind: 'oracle-hack',
					asset: { chain: 'ethereum', symbol: 'PRIME', address: '0xp1' },
					loss: makeLoss({ status: 'computed', min_usd: 12_000_000, max_usd: 124_000_000, window_type: 'event' }),
					...(oracleAdmins !== undefined ? { oracle_admins: oracleAdmins } : {})
				} as never)
			]
		})

	test('breaks a single affected collateral out into perAsset (min floor, max ceiling, admins)', () => {
		const admins = [{ address: '0xadm', kind: 'safe', threshold: 4, signers: 9 }]
		const [scenario] = buildScenarios(fullDrainVault(admins), scenarioDeps())
		if (!scenario) throw new Error('Expected full-drain scenario')
		expect(scenario.perAsset).toHaveLength(1)
		expect(scenario.perAsset![0]!.lossMinUsd).toBe(12_000_000)
		expect(scenario.perAsset![0]!.lossMaxUsd).toBe(124_000_000)
		expect(scenario.perAsset![0]!.oracleAdmins).toEqual(admins)
		// scenario-level range mirrors the (single) row
		expect(scenario.lossMinUsd).toBe(12_000_000)
		expect(scenario.lossMaxUsd).toBe(124_000_000)
	})

	test('leaves oracleAdmins undefined when the backend did not resolve the admin this tick', () => {
		const [scenario] = buildScenarios(fullDrainVault(undefined), scenarioDeps())
		if (!scenario) throw new Error('Expected full-drain scenario')
		expect(scenario.perAsset).toHaveLength(1)
		expect(scenario.perAsset![0]!.oracleAdmins).toBeUndefined()
	})

	test('a single-asset market-oracle-compromise still gets no perAsset breakout (unchanged)', () => {
		const v = makeVaultRiskFixture({
			vault_specific_risks: [
				makeScenario({
					scenario_id: 'market-oracle-compromise',
					kind: 'oracle-hack',
					asset: { chain: 'ethereum', symbol: 'PRIME', address: '0xp1' },
					loss: makeLoss({ status: 'computed', min_usd: 0, max_usd: 12_000_000 })
				})
			]
		})
		const [scenario] = buildScenarios(v, scenarioDeps())
		if (!scenario) throw new Error('Expected market-oracle scenario')
		expect(scenario.perAsset).toBeUndefined()
	})
})

describe('mergeCoverage + coverageForScenario', () => {
	// vault + protocol coverage with (a) an exact duplicate across both, (b) differing
	// priorities, (c) an excl-own-tokens cap, (d) a scenario-scoped layer.
	const dup = makeCoverage({
		kind: 'umbrella',
		access: 'gov_vote',
		cap_usd: 1000,
		priority: 1,
		applies_to: ['gov-capture']
	})
	const vaultCov = () =>
		makeVaultRiskFixture({
			coverage: [dup, makeCoverage({ kind: 'treasury', access: 'instant', cap_usd: 500, priority: 0 })]
		})
	const protoCov = () =>
		makeProtocolRiskFixture({
			coverage: [
				dup, // exact duplicate of the vault umbrella → must collapse
				makeCoverage({
					kind: 'insurance-protocol',
					access: 'gov_vote',
					cap_usd: 2000,
					cap_usd_excl_own_tokens: 1500,
					priority: 2
				})
			]
		})

	test('merges vault+protocol coverage, dedupes duplicates, prefers excl-own-tokens cap, sorts by priority', () => {
		const merged = mergeCoverage(vaultCov(), protoCov())
		expect(merged.map((c) => [c.kind, c.capUsd])).toEqual([
			['treasury', 500],
			['umbrella', 1000],
			['insurance-protocol', 1500]
		])
	})

	test('filters coverage by applies_to', () => {
		const merged = mergeCoverage(vaultCov(), protoCov())
		const matched = coverageForScenario(merged, 'gov-capture')
		expect(matched.length).toBeGreaterThan(0)
		expect(matched.every((c) => c.appliesTo.includes('gov-capture'))).toBe(true)
	})
})

describe('buildHeadline', () => {
	test('worst-case excludes non-computed; uncovered = worst − coverage; blast radius = max collateral trust', () => {
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				pool_total_supply_usd: 1_000_000,
				vault_specific_risks: [
					makeScenario({ scenario_id: 'oracle-hack-chainlink', loss: makeLoss({ status: 'computed', max_usd: 500 }) }),
					// a huge data_gap must never win the worst case (not a complete figure)
					makeScenario({ scenario_id: 'oracle-staleness', loss: makeLoss({ status: 'data_gap', max_usd: 999_999 }) })
				],
				collateral_risks: [
					makeCollateral({ aggregate_trust_usd: 700 }),
					makeCollateral({ aggregate_trust_usd: 300, token: { chain: 'ethereum', symbol: 'B', address: '0xb' } })
				],
				coverage: [
					makeCoverage({ kind: 'umbrella', access: 'gov_vote', cap_usd: 300, applies_to: ['oracle-hack-chainlink'] })
				]
			})
		)
		const h = vm.headline
		expect(h.worstCaseMaxUsd).toBeCloseTo(500, 2)
		expect(h.coverageTotalUsd).toBeCloseTo(300, 2)
		expect(h.uncoveredMaxUsd).toBeCloseTo(Math.max(0, h.worstCaseMaxUsd - h.coverageTotalUsd), 2)
		expect(h.uncoveredMaxUsd).toBeCloseTo(200, 2)
		expect(h.aggregateTrustUsd).toBeCloseTo(700, 2)
	})

	test('ties at the loss cap break toward no-escape, and coverage is scoped to that scenario', () => {
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				pool_total_supply_usd: 1_000_000,
				vault_specific_risks: [
					// exit-window scenario, tied on loss with the no-escape one below
					makeScenario({
						scenario_id: 'smart-contract-bug',
						loss: makeLoss({ status: 'computed', max_usd: 500, window_type: 'exit' })
					}),
					makeScenario({
						scenario_id: 'oracle-hack-chainlink',
						loss: makeLoss({ status: 'computed', max_usd: 500, window_type: 'event' })
					})
				],
				coverage: [
					makeCoverage({ kind: 'umbrella', access: 'gov_vote', cap_usd: 300, applies_to: ['oracle-hack-chainlink'] }),
					// discretionary money never counts, even though it names the worst case
					makeCoverage({
						kind: 'treasury',
						access: 'discretionary',
						cap_usd: 9999,
						applies_to: ['oracle-hack-chainlink']
					})
				]
			})
		)
		const h = vm.headline
		expect(h.worstCaseScenarioId).toBe('oracle-hack-chainlink')
		expect(h.worstCaseWindow?.kind).toBe('no-escape')
		// only the committed layer naming the worst case counts (300), not the discretionary 9_999
		expect(h.coverageTotalUsd).toBeCloseTo(300, 2)
		const blind = vm.coverage.reduce((a, c) => a + c.capUsd, 0)
		expect(h.coverageTotalUsd).toBeLessThan(blind)
	})

	test('among tied no-escape scenarios, the least-covered one is the worst case', () => {
		// two no-escape scenarios tied on loss; only one is covered → the uncovered one is worst,
		// and the headline must not borrow the other's backstop.
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				pool_total_supply_usd: 1_000_000,
				vault_specific_risks: [
					makeScenario({
						scenario_id: 'oracle-hack-chainlink',
						loss: makeLoss({ status: 'computed', max_usd: 500, window_type: 'event' })
					}),
					makeScenario({
						scenario_id: 'smart-contract-bug',
						loss: makeLoss({ status: 'computed', max_usd: 500, window_type: 'event' })
					})
				],
				coverage: [
					makeCoverage({ kind: 'umbrella', access: 'gov_vote', cap_usd: 500, applies_to: ['oracle-hack-chainlink'] })
				]
			})
		)
		const h = vm.headline
		expect(h.worstCaseScenarioId).toBe('smart-contract-bug')
		expect(h.worstCaseWindow?.kind).toBe('no-escape')
		const umbrella = vm.coverage.find((c) => c.kind === 'umbrella')!
		expect(umbrella.appliesTo.includes('smart-contract-bug')).toBe(false)
		expect(h.coverageTotalUsd).toBeLessThan(umbrella.capUsd + 1)
	})

	test('does not count discretionary coverage as a committed backstop', () => {
		const d = makeVaultRiskData({
			pool_total_supply_usd: 1_000_000,
			vault_specific_risks: [
				makeScenario({ scenario_id: 'gov-capture', loss: makeLoss({ status: 'computed', max_usd: 500 }) })
			],
			coverage: [
				makeCoverage({ kind: 'treasury', access: 'discretionary', cap_usd: 5000, applies_to: ['gov-capture'] })
			]
		})
		const merged = mergeCoverage(d.vault, d.protocol)
		expect(merged.some((c) => c.kind === 'treasury' && c.access === 'discretionary')).toBe(true)
		const vm = buildVaultRiskVM(d)
		expect(vm.headline.coverageTotalUsd).toBe(0)
		expect(vm.headline.worstCaseCovered).toBe(false)
	})
})

describe('buildVaultRiskVM exit readiness', () => {
	test('vault → null live liquidity; market → populated', () => {
		const vaultVm = buildVaultRiskVM(
			makeVaultRiskData({ pool_type: 'vault', available_liquidity_usd: null, utilization: null })
		)
		expect(vaultVm.poolType).toBe('vault')
		expect(vaultVm.exitReadiness.availableLiquidityUsd).toBeNull()
		const marketVm = buildVaultRiskVM(
			makeVaultRiskData({ pool_type: 'market', available_liquidity_usd: 200_000, utilization: 0.5 })
		)
		expect(marketVm.poolType).toBe('market')
		expect(marketVm.exitReadiness).toMatchObject({ availableLiquidityUsd: 200_000, utilization: 0.5 })
	})

	test('magnitudePct is 0 for non-computed and within (0,1] for the worst computed', () => {
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				vault_specific_risks: [
					makeScenario({ scenario_id: 'smart-contract-bug', loss: makeLoss({ status: 'computed', max_usd: 500 }) }),
					makeScenario({ scenario_id: 'oracle-staleness', loss: makeLoss({ status: 'data_gap', max_usd: 0 }) })
				]
			})
		)
		const uncomputed = vm.scenarios.filter((s) => s.status !== 'computed')
		expect(uncomputed.length).toBeGreaterThan(0)
		expect(uncomputed.map((s) => s.magnitudePct)).toEqual(uncomputed.map(() => 0))
		const top = vm.scenarios.find((s) => s.status === 'computed')
		expect(top!.magnitudePct).toBeGreaterThan(0)
	})
})

describe('depositor cap (loss never exceeds pool supply)', () => {
	test('does not cap losses or derive exposure shares when pool supply is unknown', () => {
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				pool_total_supply_usd: null,
				vault_specific_risks: [
					makeScenario({ scenario_id: 'unknown-supply', loss: makeLoss({ status: 'computed', max_usd: 500 }) })
				],
				collateral_risks: [makeCollateral({ exposure_usd: 250, exposure_pct: null })]
			})
		)
		const scenario = vm.scenarios.find((item) => item.scenarioId === 'unknown-supply')!
		expect(vm.supplyUsd).toBeNull()
		expect(scenario.lossMaxUsd).toBe(500)
		expect(scenario.cappedAtSupply).toBeUndefined()
		expect(vm.collateral[0]?.exposurePct).toBeNull()
	})

	test('clamps a scenario that exceeds supply and preserves the raw ceiling', () => {
		const supply = 1000
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				pool_total_supply_usd: supply,
				vault_specific_risks: [
					makeScenario({
						scenario_id: 'wide-crypto-drop',
						loss: makeLoss({ status: 'computed', max_usd: supply * 10, min_usd: supply * 10 })
					})
				]
			})
		)
		const capped = vm.scenarios.find((s) => s.cappedAtSupply)
		expect(capped).toBeTruthy()
		expect(capped!.rawLossMaxUsd!).toBeGreaterThan(supply)
		expect(capped!.lossMaxUsd).toBe(supply)
	})
})

describe('resolveRef', () => {
	const p = makeProtocolRiskFixture({
		external_dependencies: [
			{
				id: 'chainlink',
				kind: 'oracle',
				name: 'Chainlink',
				description: 'Price oracle',
				relevance: 'principal',
				source_url: 'https://chain.link'
			},
			{
				id: 'l2.sequencer',
				kind: 'infra',
				name: 'L2 Sequencer',
				description: 'Sequencer dependency',
				relevance: 'principal',
				source_url: 'https://seq'
			}
		]
	})
	test('oracle_config → in-page anchor', () => {
		expect(resolveRef('oracle_config', p)).toMatchObject({ anchor: true })
	})
	test('entity.aspect → resolves prefix to a dependency with aspect label', () => {
		const r = resolveRef('chainlink.multisig', p)
		expect(r.label.toLowerCase()).toContain('chainlink')
		expect(r.label).toContain('multisig')
	})
	test('exact dotted id resolves to its dependency', () => {
		expect(resolveRef('l2.sequencer', p).url).toBe('https://seq')
	})
	test('unknown ref falls back to a plain label', () => {
		expect(resolveRef('cross-chain-message-bus', p)).toEqual({ label: 'cross-chain-message-bus' })
	})
})

describe('fixture fields reach the VM (passthrough)', () => {
	// One rich vault carrying every optional lane the section renders, so the passthrough
	// assertions all read from a single, legible construction.
	const richData = () =>
		makeVaultRiskData(
			{
				pool_total_supply_usd: 1_000_000,
				risk_tier: {
					tier: 'moderate',
					relative_band: 'moderate',
					capped_by: [],
					facts: [{ label: 'Audited by two firms', polarity: 'good' }],
					limited_data: false
				},
				vault_roles: makeVaultRoles({
					owner: makeRoleEntity({ address: '0xowner', kind: 'contract' }),
					allocators: []
				}),
				collateral_risks: [
					makeCollateral({
						liquidation_threshold: 0.8,
						bad_debt_at_price_zero_usd: 900,
						exposure_usd: 1000,
						exposure_pct: 0.3,
						market_loss_ceiling_usd: 2000,
						oracle_providers: ['Chainlink'],
						oracle_addresses: ['0xfeed'],
						feed_kinds: ['aggregator'],
						vault_market_share: 0.5
					})
				],
				stress: makeStress({ anchors: [makeStressAnchor({ drop_pct: 30, bad_debt_usd: 125 })] }),
				oracle_dependencies: [
					{
						admin_address: '0xadmin',
						admin_kind: 'safe',
						vendors: ['Chainlink'],
						collateral_symbols: ['TOK'],
						exposure_usd: 1000,
						exposure_pct: 0.5
					}
				],
				market_oracles: [],
				external_dependencies: [
					{ id: 'dep-1', kind: 'oracle', name: 'Dep', description: 'Oracle dependency', relevance: 'principal' }
				]
			},
			{ governance: makeGovernance({ top10_clears_quorum: true, voting_power_top10_tokens: 1000 }) }
		)

	test('maps depeg anchors onto collateral rows', () => {
		const vm = buildVaultRiskVM(richData())
		expect(vm.collateral.map((c) => [c.liquidationThreshold, c.badDebtAtZeroUsd])).toEqual([[0.8, 900]])
	})

	test('passes the vault role registry through (and null when absent)', () => {
		const vm = buildVaultRiskVM(richData())
		expect(vm.vaultRoles?.owner).toMatchObject({ address: '0xowner', kind: 'contract' })
		const market = buildVaultRiskVM(makeVaultRiskData({ pool_type: 'market' }))
		expect(market.vaultRoles).toBeNull()
	})

	test('passes the relative risk_tier through (band + facts)', () => {
		const vm = buildVaultRiskVM(richData())
		expect(vm.riskTier?.tier).toBe('moderate')
		expect(vm.riskTier?.facts).toEqual([{ label: 'Audited by two firms', polarity: 'good' }])
	})

	test('binds collateral exposurePct to a 0–1 share and surfaces oracle vendors/addresses', () => {
		const vm = buildVaultRiskVM(richData())
		expect(vm.collateral.map((c) => [c.exposurePct, c.oracleProviders, c.oracleAddresses])).toEqual([
			[0.3, ['Chainlink'], ['0xfeed']]
		])
	})
})

describe('vault depeg stress curve', () => {
	// Replaces the former corpus-wide scan over every on-disk fixture (which depended on the
	// gitignored fixture dir) with a deterministic, hand-derived check: for a single collateral
	// with borrowed debt 1_000 at LT 0.8 and a 1_000 zero-price ceiling, the no-liquidation bad
	// debt is debt × max(0, 1 − (1−drop)/LT), so −30% → 125, −50% → 375, −100% → 1_000.
	const stressVault = () =>
		makeVaultRiskFixture({
			collateral_risks: [
				makeCollateral({
					liquidation_threshold: 0.8,
					collateral_borrowed_debt_usd: 1000,
					bad_debt_at_price_zero_usd: 1000,
					vault_allocation_usd: null
				})
			],
			stress: makeStress({
				anchors: [
					makeStressAnchor({ drop_pct: 30, bad_debt_usd: 125 }),
					makeStressAnchor({ drop_pct: 50, bad_debt_usd: 375 })
				]
			})
		})

	test('the FE stress helper reproduces every served stress anchor and full-drop collateral loss', () => {
		const v = stressVault()
		const collateral = buildCollateral(v)
		for (const anchor of v.stress!.anchors) {
			expect(vaultDepegLossUsd(collateral, anchor.drop_pct / 100)).toBeCloseTo(anchor.bad_debt_usd, 2)
		}
		expect(vaultDepegLossUsd(collateral, 1)).toBeCloseTo(1000, 2)
		expect(vaultDepegLossUsd(collateral, 0.1)).toBeLessThan(vaultDepegLossUsd(collateral, 0.3)) // monotonic
	})

	test('a macro-crash pool renders its served per-drop curve', () => {
		const vm = buildVaultRiskVM(
			makeVaultRiskData({
				protocol_id: 'morpho-blue',
				pool_total_supply_usd: 1_000_000,
				vault_specific_risks: [
					makeScenario({
						scenario_id: 'wide-crypto-drop',
						kind: 'macro',
						loss: makeLoss({
							status: 'computed',
							max_usd: 200_000,
							by_anchor: [
								{ drop_pct: 10, loss_usd: 20_000 },
								{ drop_pct: 30, loss_usd: 80_000 },
								{ drop_pct: 50, loss_usd: 150_000 }
							]
						})
					})
				],
				coverage: [makeCoverage({ kind: 'treasury', access: 'discretionary', cap_usd: 5000 })],
				realized_incidents: [],
				stress: makeStress({ anchors: [makeStressAnchor({ drop_pct: 30, bad_debt_usd: 80_000 })] })
			})
		)
		const crash = vm.scenarios.find((s) => s.scenarioId === 'wide-crypto-drop')!
		expect(crash.lossByAnchor).toEqual([
			{ dropPct: 10, lossUsd: 20_000 },
			{ dropPct: 30, lossUsd: 80_000 },
			{ dropPct: 50, lossUsd: 150_000 }
		])
		expect(anyHasAnchors(vm.scenarios)).toBe(true)
	})
})

describe('collateral depeg math (inline rows)', () => {
	test('does not invent depeg loss from exposure when bad-debt attribution is missing', () => {
		const row = {
			liquidationThreshold: 0.86,
			borrowedDebtUsd: 1_000_000,
			badDebtAtZeroUsd: null,
			badDebtMarkets: [],
			allocationUsd: 1_000_000,
			exposureUsd: 1_000_000
		}
		expect(collateralDepegLossUsd(row, 1)).toBe(0)
		expect(vaultDepegLossUsd([row], 1)).toBe(0)
		expect(collateralMarketBreakLossUsd(row)).toBe(1_000_000)
	})

	test('keeps oracle-drain separate from the market-break bad-debt number', () => {
		const row = {
			liquidationThreshold: 0.86,
			borrowedDebtUsd: 208,
			badDebtAtZeroUsd: 208,
			badDebtMarkets: [],
			allocationUsd: 231,
			exposureUsd: 231,
			drainableUsd: 23
		}
		expect(collateralMarketBreakLossUsd(row)).toBe(208)
	})

	test('sums per-market bad-debt curves with each market LLTV', () => {
		const row = {
			liquidationThreshold: 0.8,
			borrowedDebtUsd: 300,
			badDebtAtZeroUsd: 300,
			badDebtMarkets: [
				{ lltv: 0.5, badDebtAtZeroUsd: 100 },
				{ lltv: 0.8, badDebtAtZeroUsd: 200 }
			],
			allocationUsd: null
		}
		expect(collateralDepegLossUsd(row, 0.3)).toBeCloseTo(25)
	})

	test('uses borrowed debt as the single-collateral slope and bad-debt-at-zero as the cap', () => {
		const row = {
			liquidationThreshold: 0.8,
			borrowedDebtUsd: 1000,
			badDebtAtZeroUsd: 500,
			badDebtMarkets: [],
			allocationUsd: null
		}
		expect(collateralDepegLossUsd(row, 0.5)).toBeCloseTo(375)
		expect(collateralDepegLossUsd(row, 1)).toBeCloseTo(500)
	})

	test('sums custom-by-asset drops into one vault loss', () => {
		const rows = [
			{
				address: '0xcb',
				liquidationThreshold: 0.8,
				borrowedDebtUsd: 1000,
				badDebtAtZeroUsd: 1000,
				badDebtMarkets: [],
				allocationUsd: null
			},
			{
				address: '0xws',
				liquidationThreshold: 0.8,
				borrowedDebtUsd: 1000,
				badDebtAtZeroUsd: 1000,
				badDebtMarkets: [],
				allocationUsd: null
			},
			{
				address: '0xce',
				liquidationThreshold: 0.95,
				borrowedDebtUsd: 200,
				badDebtAtZeroUsd: 200,
				badDebtMarkets: [{ lltv: 0.95, badDebtAtZeroUsd: 200 }],
				allocationUsd: null
			}
		]
		const drops = new Map([
			['0xcb', 0.3],
			['0xws', 0],
			['0xce', 0.1]
		])
		const expectedCbBtc = 1000 * (1 - 0.7 / 0.8)
		const expectedCbEth = 200 * (1 - 0.9 / 0.95)
		expect(vaultDepegLossUsdAtDrops(rows, (c) => drops.get(c.address)!)).toBeCloseTo(expectedCbBtc + expectedCbEth)
	})
})

// bad_debt_basis → presentation only (magnitude unchanged): never dress an unmodeled ceiling
// as a precise loss, a confident zero as missing data, or a market-wide estimate as precise.
describe('marketBreakPresentation (bad_debt_basis rendering)', () => {
	test('unmodeled basis → "unmodeled" with exposure as a ceiling, never a precise loss', () => {
		const row = {
			badDebtBasis: 'unmodeled' as const,
			badDebtAtZeroUsd: null,
			badDebtMarkets: [],
			borrowedDebtUsd: null,
			liquidationThreshold: 0.9,
			allocationUsd: 50_000,
			exposureUsd: 10_000
		}
		expect(marketBreakPresentation(row)).toEqual({ kind: 'unmodeled', ceilingUsd: 10_000 })
	})

	test('absent basis + null bad-debt (legacy) also reads as unmodeled, not exposure-as-loss', () => {
		const row = {
			badDebtBasis: null,
			badDebtAtZeroUsd: null,
			badDebtMarkets: [],
			borrowedDebtUsd: null,
			liquidationThreshold: null,
			allocationUsd: null,
			exposureUsd: 7000
		}
		expect(marketBreakPresentation(row)).toEqual({ kind: 'unmodeled', ceilingUsd: 7000 })
	})

	test('position-scan modeled to exactly $0 → confident-zero (a borrow-disabled reserve)', () => {
		const row = {
			badDebtBasis: 'position-scan' as const,
			badDebtAtZeroUsd: 0,
			badDebtMarkets: [],
			borrowedDebtUsd: 0,
			liquidationThreshold: 0.83,
			allocationUsd: 286_000,
			exposureUsd: 286_000
		}
		expect(marketBreakPresentation(row)).toEqual({ kind: 'confident-zero' })
	})

	test('position-scan with a positive figure → precise (not approximate)', () => {
		const row = {
			badDebtBasis: 'position-scan' as const,
			badDebtAtZeroUsd: 500,
			badDebtMarkets: [],
			borrowedDebtUsd: 1000,
			liquidationThreshold: 0.8,
			allocationUsd: null,
			exposureUsd: 2000
		}
		expect(marketBreakPresentation(row)).toEqual({ kind: 'modeled', usd: 500, approximate: false })
	})

	test('market-wide basis → modeled but flagged approximate', () => {
		const row = {
			badDebtBasis: 'market-wide' as const,
			badDebtAtZeroUsd: 92_904_124,
			badDebtMarkets: [],
			borrowedDebtUsd: 113_743_107,
			liquidationThreshold: null,
			allocationUsd: 77_495_559,
			exposureUsd: 77_495_559
		}
		expect(marketBreakPresentation(row)).toEqual({ kind: 'modeled', usd: 77_495_559, approximate: true })
	})

	test('absent basis with a real figure stays precise (no regression)', () => {
		const row = {
			badDebtBasis: null,
			badDebtAtZeroUsd: 300,
			badDebtMarkets: [],
			borrowedDebtUsd: 300,
			liquidationThreshold: 0.93,
			allocationUsd: null,
			exposureUsd: 40_000
		}
		expect(marketBreakPresentation(row)).toEqual({ kind: 'modeled', usd: 300, approximate: false })
	})
})

describe('buildCollateral — oracle explanation fields', () => {
	const coll = (symbol: string, address: string, oracle_type: OracleType = 'hybrid') =>
		makeCollateral({ token: { chain: 'ethereum', symbol, address }, oracle_type })
	type FixtureOverrides = Omit<Partial<VaultRiskFixture>, 'oracle_config' | 'market_oracles'> & {
		oracle_config?: Array<
			Partial<OracleConfigEntry> & Pick<OracleConfigEntry, 'type' | 'asset_address' | 'oracle_address'>
		>
		market_oracles?: Array<Partial<MarketOracle> & Pick<MarketOracle, 'market_id' | 'collateral_asset'>>
	}
	const build = ({ oracle_config = [], market_oracles = [], ...fixture }: FixtureOverrides) =>
		buildCollateral(
			makeVaultRiskFixture({
				pool_total_supply_usd: 0,
				collateral_risks: [],
				...fixture,
				oracle_config: oracle_config.map((entry) => ({
					chain: 'ethereum',
					instance: 'test',
					asset_symbol: 'TOK',
					...entry,
					source_attribution: entry.source_attribution ?? { value: 'test fixture' }
				})),
				market_oracles: market_oracles.map((market) => ({
					loan_asset: null,
					allocation_usd: null,
					supply_cap_usd: null,
					lltv: null,
					oracle_address: null,
					oracle_type: 'unknown',
					oracle_providers: [],
					feed_kind: null,
					attribution: 'unclassified',
					oracle_instance: null,
					...market
				}))
			})
		)

	test('surfaces mechanism_summary, base_leg, quote_leg and pt_pricing from oracle_config', () => {
		const [c] = build({
			collateral_risks: [coll('PT-x', '0xAA')],
			oracle_config: [
				{
					type: 'hybrid',
					asset_address: '0xaa', // matched case-insensitively against the token address
					oracle_address: '0xfeed',
					mechanism_summary: 'PT-x uses a Pendle linear-discount PT model.',
					base_leg: 'Pendle linear-discount PT rate',
					quote_leg: 'No independent quote feed identified',
					pt_pricing: 'linear_discount'
				}
			]
		})
		if (!c) throw new Error('Expected collateral')
		expect(c.oracleMechanism).toBe('PT-x uses a Pendle linear-discount PT model.')
		expect(c.oracleBaseLeg).toBe('Pendle linear-discount PT rate')
		expect(c.oracleQuoteLeg).toBe('No independent quote feed identified')
		expect(c.ptPricing).toBe('linear_discount')
	})

	test('falls back to the collateral market oracle when oracle_config lacks the fields', () => {
		const [c] = build({
			collateral_risks: [coll('siUSD', '0xBB')],
			oracle_config: [{ type: 'hybrid', asset_address: '0xbb', oracle_address: '0xfeed' }],
			market_oracles: [
				{
					market_id: '0x1',
					collateral_asset: { symbol: 'siUSD', address: '0xBB', chain: 'ethereum' },
					mechanism_summary: 'siUSD uses a composite oracle path.',
					base_leg: 'Composite base price path',
					quote_leg: 'No independent quote feed identified'
				}
			]
		})
		if (!c) throw new Error('Expected collateral')
		expect(c.oracleMechanism).toBe('siUSD uses a composite oracle path.')
		expect(c.oracleBaseLeg).toBe('Composite base price path')
		expect(c.ptPricing).toBeNull()
	})

	test('prefers oracle_config over the market oracle, and stays null when neither resolves', () => {
		const rows = build({
			collateral_risks: [coll('A', '0xCC'), coll('B', '0xDD')],
			oracle_config: [
				{ type: 'hybrid', asset_address: '0xcc', oracle_address: '0x1', mechanism_summary: 'from config' }
			],
			market_oracles: [
				{
					market_id: '0x2',
					collateral_asset: { symbol: 'A', address: '0xCC', chain: 'ethereum' },
					mechanism_summary: 'from market'
				}
			]
		})
		const withCfg = rows.find((r) => r.symbol === 'A')!
		const bare = rows.find((r) => r.symbol === 'B')!
		expect(withCfg.oracleMechanism).toBe('from config')
		expect(bare.oracleMechanism).toBeNull()
		expect(bare.oracleBaseLeg).toBeNull()
		expect(bare.oracleQuoteLeg).toBeNull()
		expect(bare.oracleLegs).toBeNull()
		expect(bare.ptPricing).toBeNull()
	})

	test('surfaces resolved oracle legs from oracle_config, falls back to the market oracle, else null', () => {
		const [fromCfg] = build({
			collateral_risks: [coll('cbETH', '0xEE')],
			oracle_config: [
				{
					type: 'market',
					asset_address: '0xee',
					oracle_address: '0xfeed',
					legs: [
						{ slot: 'base1', description: 'CBETH / ETH', vendor: 'Chainlink', kind: 'market' },
						{ slot: 'base2', description: 'ETH / USD', vendor: 'Chainlink', kind: 'market' },
						{ slot: 'quote1', description: 'USDC / USD', vendor: 'Chainlink', kind: 'market' }
					]
				}
			]
		})
		if (!fromCfg) throw new Error('Expected config-backed collateral')
		expect(fromCfg.oracleLegs?.map((l) => l.description)).toEqual(['CBETH / ETH', 'ETH / USD', 'USDC / USD'])

		const [fromMarket] = build({
			collateral_risks: [coll('weETH', '0xFF')],
			oracle_config: [{ type: 'hybrid', asset_address: '0xff', oracle_address: '0xfeed' }],
			market_oracles: [
				{
					market_id: '0x1',
					collateral_asset: { symbol: 'weETH', address: '0xFF', chain: 'ethereum' },
					legs: [{ slot: 'base1', description: 'weETH / ETH', vendor: 'RedStone', kind: 'exchange-rate' }]
				}
			]
		})
		if (!fromMarket) throw new Error('Expected market-backed collateral')
		expect(fromMarket.oracleLegs?.[0]).toMatchObject({ description: 'weETH / ETH', kind: 'exchange-rate' })

		const [none] = build({
			collateral_risks: [coll('X', '0x11')],
			oracle_config: [{ type: 'hybrid', asset_address: '0x11', oracle_address: '0xfeed' }]
		})
		if (!none) throw new Error('Expected collateral without oracle legs')
		expect(none.oracleLegs).toBeNull()
	})
})

describe('buildCollateral — oracle badge (server-authoritative)', () => {
	const collRow = ({
		symbol = 'TOK',
		address,
		oracle_type = 'hybrid',
		feed_kinds = [],
		oracle_providers = []
	}: {
		symbol?: string
		address: string
		oracle_type?: OracleType
		feed_kinds?: Array<string>
		oracle_providers?: Array<string>
	}): CollateralRisk =>
		makeCollateral({
			token: { chain: 'ethereum', symbol, address },
			oracle_type,
			feed_kinds,
			oracle_providers
		})
	const cfg = ({
		address,
		type = 'hybrid',
		feed_kind,
		provider
	}: {
		address: string
		type?: OracleType
		feed_kind?: string
		provider?: Array<string>
	}): OracleConfigEntry => ({
		type,
		chain: 'ethereum',
		instance: 'test',
		asset_symbol: 'TOK',
		asset_address: address,
		oracle_address: '0xfeed',
		source_attribution: { value: 'test fixture' },
		...(feed_kind !== undefined ? { feed_kind } : {}),
		...(provider !== undefined ? { provider } : {})
	})
	const typeOf = (collateral: CollateralRisk, config?: OracleConfigEntry): string | undefined =>
		buildCollateral(
			makeVaultRiskFixture({
				pool_total_supply_usd: 0,
				collateral_risks: [collateral],
				oracle_config: config ? [config] : []
			})
		)[0]!.oracleType

	// The oracle_config entry disagrees with the collateral row; the row's type wins.
	test('takes the collateral oracle_type verbatim, never the oracle_config type', () => {
		expect(
			typeOf(
				collRow({ symbol: 'cbETH', address: '0xAA', oracle_type: 'hybrid' }),
				cfg({ address: '0xAA', type: 'market', feed_kind: 'aggregator', provider: ['Chainlink'] })
			)
		).toBe('hybrid')
		expect(
			typeOf(
				collRow({ symbol: 'cbETH', address: '0xAB', oracle_type: 'market' }),
				cfg({ address: '0xAB', type: 'hybrid', feed_kind: 'aggregator', provider: ['Chainlink'] })
			)
		).toBe('market')
	})

	test('keeps every stored type exactly as served (hardcoded / aum / hybrid)', () => {
		expect(typeOf(collRow({ address: '0xEE', oracle_type: 'hardcoded' }))).toBe('hardcoded')
		expect(typeOf(collRow({ address: '0xEF', oracle_type: 'aum' }))).toBe('aum')
		expect(typeOf(collRow({ address: '0xF0', oracle_type: 'hybrid' }))).toBe('hybrid')
	})
})

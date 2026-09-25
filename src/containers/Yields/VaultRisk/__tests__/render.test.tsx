import type { ReactElement } from 'react'
import { prerenderToNodeStream } from 'react-dom/static.node'
import { describe, expect, test } from 'vitest'
import { CollateralView } from '../components/CollateralView'
import { ScenarioDetailContent } from '../components/ScenarioDetailPanel'
import { TrustPanel } from '../components/TrustPanel'
import { buildVaultRiskVM } from '../derive'
import type { CollateralRisk, VaultRiskData, VaultScenario } from '../types'
import { VaultRiskSection } from '../VaultRiskSection'
import {
	makeAudit,
	makeCollateral,
	makeCoverage,
	makeFreshness,
	makeGovernance,
	makeLoss,
	makeMultisig,
	makeProtocolRiskFixture,
	makeRoleEntity,
	makeScenario,
	makeStress,
	makeStressAnchor,
	makeVaultRiskFixture,
	makeVaultRoles
} from './factories'

// prerenderToNodeStream fully resolves Suspense (lazy ECharts), unlike sync renderToStaticMarkup.
async function render(el: ReactElement): Promise<string> {
	const { prelude } = await prerenderToNodeStream(el)
	const chunks: Array<Buffer> = []
	for await (const chunk of prelude) chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks).toString('utf8')
}

const text = (html: string) =>
	html
		.replaceAll('<!-- -->', '')
		.replace(/<[^>]+>/g, '')
		.replaceAll('&amp;', '&')
		.trim()

// Visible text of each cell in one rendered scenario row.
function rowCells(html: string, rowId: string): Array<string> {
	const row = html.match(new RegExp(`<tr id="${rowId}"[^>]*>([\\s\\S]*?)</tr>`))![1]!
	return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => text(cell!))
}

const UPDATED_TS = 1_780_000_000 // fixed unix seconds → deterministic "Updated …" footer

// A Morpho-style VAULT: price-driven curve (stress toggle), a full-deposit smart-contract row, a
// fanned oracle-compromise, live vault roles with a queued change, and a resolved oracle-admin Safe.
function morphoData(): VaultRiskData {
	const weETH = {
		chain: 'ethereum',
		symbol: 'weETH',
		address: '0x00000000000000000000000000000000000000aa'
	}
	const cbETH = {
		chain: 'ethereum',
		symbol: 'cbETH',
		address: '0x00000000000000000000000000000000000000bb'
	}
	const collateral = (token: typeof weETH, badDebt: number): CollateralRisk =>
		makeCollateral({
			token,
			market_loss_ceiling_usd: 3_000_000,
			vault_allocation_usd: 2_000_000,
			exposure_usd: 2_000_000,
			supply_cap_usd: 4_000_000,
			liquidation_threshold: 0.86,
			collateral_borrowed_debt_usd: 1_500_000,
			bad_debt_at_price_zero_usd: badDebt,
			bad_debt_basis: 'position-scan',
			bad_debt_markets: [{ lltv: 0.86, bad_debt_at_zero_usd: badDebt }],
			drainable_usd: 500_000,
			aggregate_trust_usd: 10_000_000,
			vault_count: 5,
			oracle_type: 'market',
			oracle_addresses: ['0x00000000000000000000000000000000000feed0'],
			oracle_providers: ['Chainlink'],
			feed_kinds: ['aggregator'],
			exposure_pct: 0.2,
			vault_market_share: 0.3
		})
	const scenarios: Array<VaultScenario> = [
		makeScenario({
			id: 'sc-scb',
			scenario_id: 'smart-contract-bug',
			kind: 'smart-contract',
			description: 'A bug in the vault contract drains deposits.',
			loss: makeLoss({
				status: 'computed',
				min_usd: 10_000_000,
				max_usd: 10_000_000,
				window_type: 'event',
				time_window_sec: { min: 0, max: 0 }
			})
		}),
		makeScenario({
			id: 'sc-macro',
			scenario_id: 'wide-crypto-drop',
			title: 'Wide crypto crash',
			kind: 'macro',
			description: 'A broad market crash pushes collateral below its liquidation threshold.',
			loss: makeLoss({
				status: 'computed',
				min_usd: 0,
				max_usd: 1_800_000,
				inputs: { drop_pct: 30 },
				by_anchor: [
					{ drop_pct: 10, loss_usd: 0 },
					{ drop_pct: 30, loss_usd: 900_000 },
					{ drop_pct: 50, loss_usd: 1_800_000 }
				]
			})
		}),
		makeScenario({
			id: 'sc-orc-weeth',
			scenario_id: 'market-oracle-compromise',
			kind: 'oracle-hack',
			asset: weETH,
			description: 'A compromised feed misprices collateral in the markets this vault supplies.',
			loss: makeLoss({
				status: 'computed',
				min_usd: 500_000,
				max_usd: 500_000
			})
		}),
		makeScenario({
			id: 'sc-orc-cbeth',
			scenario_id: 'market-oracle-compromise',
			kind: 'oracle-hack',
			asset: cbETH,
			description: 'A compromised feed misprices collateral in the markets this vault supplies.',
			loss: makeLoss({
				status: 'computed',
				min_usd: 200_000,
				max_usd: 200_000
			})
		})
	]
	return {
		vault: makeVaultRiskFixture({
			protocol_id: 'morpho-blue',
			pool_type: 'vault',
			pool_total_supply_usd: 10_000_000,
			pool_total_borrow_usd: 0,
			available_liquidity_usd: null,
			utilization: null,
			allocated_usd: 8_000_000,
			idle_usd: 2_000_000,
			last_updated_ts: UPDATED_TS,
			vault_specific_risks: scenarios,
			collateral_risks: [collateral(weETH, 900_000), collateral(cbETH, 600_000)],
			coverage: [
				makeCoverage({
					kind: 'treasury',
					access: 'discretionary',
					cap_usd: 5_000_000,
					applies_to: []
				})
			],
			stress: makeStress({
				anchors: [
					makeStressAnchor({ drop_pct: 10, bad_debt_usd: 0 }),
					makeStressAnchor({ drop_pct: 30, bad_debt_usd: 900_000 }),
					makeStressAnchor({ drop_pct: 50, bad_debt_usd: 1_800_000 })
				]
			}),
			vault_roles: makeVaultRoles({
				owner: makeRoleEntity({
					kind: 'contract',
					address: '0x00000000000000000000000000000000000000c0'
				}),
				curator: makeRoleEntity({
					kind: 'safe',
					address: '0x00000000000000000000000000000000000000c1',
					threshold: { m: 4, n: 9 }
				}),
				guardian: makeRoleEntity({
					kind: 'contract',
					address: '0x00000000000000000000000000000000000000c2'
				}),
				timelock_sec: 86_400,
				allocators: [
					makeRoleEntity({
						kind: 'contract',
						address: '0x00000000000000000000000000000000000000c3'
					})
				],
				pending_changes: [
					{
						function_name: 'SetCap',
						label: 'Set supply cap',
						valid_at: 1_782_000_000
					}
				]
			}),
			oracle_dependencies: [
				{
					admin_address: '0x00000000000000000000000000000000000000d1',
					admin_kind: 'safe',
					multisig: '4/9',
					vendors: ['Chainlink'],
					collateral_symbols: ['weETH', 'cbETH'],
					exposure_usd: 1_000_000,
					exposure_pct: 0.1
				}
			],
			oracle_exposure: {
				by_provider: [
					{
						provider: 'Chainlink',
						exposure_usd: 2_000_000,
						exposure_pct: 0.4,
						collateral_symbols: ['weETH', 'cbETH']
					}
				]
			},
			market_oracles: [
				{
					market_id: '0x1',
					collateral_asset: {
						symbol: 'weETH',
						address: weETH.address,
						chain: 'ethereum'
					},
					loan_asset: { symbol: 'USDC', chain: 'ethereum' },
					allocation_usd: 2_000_000,
					supply_cap_usd: 4_000_000,
					lltv: 0.86,
					oracle_address: '0x00000000000000000000000000000000000feed0',
					oracle_type: 'market',
					oracle_providers: ['Chainlink'],
					feed_kind: 'aggregator',
					attribution: 'market_exact',
					oracle_instance: null
				}
			],
			external_dependencies: [
				{
					id: 'chainlink',
					kind: 'oracle',
					name: 'Chainlink',
					description: 'Price oracle',
					relevance: 'principal'
				}
			],
			risk_tier: {
				tier: 'moderate',
				relative_band: 'moderate',
				capped_by: [],
				facts: [{ label: 'Audited by multiple firms', polarity: 'good' }],
				limited_data: false
			}
		}),
		protocol: makeProtocolRiskFixture({
			protocol_id: 'morpho-blue',
			audits: [makeAudit({ firm: 'Spearbit' })],
			multisigs: [
				makeMultisig({
					role: 'governance-multisig-owner',
					role_label: 'Governance owner',
					chain: 'ethereum',
					address: '0x00000000000000000000000000000000000000e5',
					threshold: { m: 5, n: 9 },
					signers: Array.from({ length: 9 }, (_, i) => ({
						address: `0x${String(i).padStart(40, '0')}`
					})),
					depositor_impact: {
						reaches_principal: true,
						gate: 'instant',
						summary: { value: 'Owner can upgrade core contracts.' }
					}
				})
			],
			governance: makeGovernance({ voting_power_concentration_top10_pct: 0.4 }),
			incidents: [
				{
					date: '2024-05-01',
					kind: 'exploit',
					technique: 'smart-contract exploit',
					classification: 'protocol',
					chain: 'ethereum',
					usd_lost: 1_000_000,
					usd_recovered: 0,
					fully_recovered: false,
					post_mortem_url: null,
					root_cause_still_possible: 'no'
				}
			],
			external_dependencies: [
				{
					id: 'chainlink',
					kind: 'oracle',
					name: 'Chainlink',
					description: 'Price oracle',
					relevance: 'principal'
				}
			]
		})
	}
}

// A governed MARKET (Compound-style): live exit liquidity, drift on the protocol, no by_anchor
// curve (so no stress toggle), no vault roles.
function compoundData(): VaultRiskData {
	const usdc = {
		chain: 'ethereum',
		symbol: 'USDC',
		address: '0x00000000000000000000000000000000000usdc0'
	}
	return {
		vault: makeVaultRiskFixture({
			protocol_id: 'compound-v3',
			pool_type: 'market',
			pool_total_supply_usd: 20_000_000,
			pool_total_borrow_usd: 14_000_000,
			available_liquidity_usd: 6_000_000,
			utilization: 0.7,
			last_updated_ts: UPDATED_TS,
			vault_specific_risks: [
				makeScenario({
					id: 'sc-scb',
					scenario_id: 'smart-contract-bug',
					kind: 'smart-contract',
					description: 'A bug in the Comet contract impairs the market.',
					loss: makeLoss({
						status: 'computed',
						min_usd: 3_000_000,
						max_usd: 3_000_000
					})
				})
			],
			collateral_risks: [
				makeCollateral({
					token: usdc,
					market_loss_ceiling_usd: 2_000_000,
					vault_allocation_usd: 1_000_000,
					exposure_usd: 1_000_000,
					bad_debt_at_price_zero_usd: 300_000,
					bad_debt_markets: [],
					collateral_borrowed_debt_usd: 300_000,
					liquidation_threshold: 0.93,
					aggregate_trust_usd: 5_000_000,
					vault_count: 3,
					oracle_type: 'market',
					oracle_providers: ['Chainlink'],
					exposure_pct: 0.05
				})
			],
			coverage: [
				makeCoverage({
					kind: 'comet-reserves',
					access: 'instant',
					cap_usd: 2_000_000,
					applies_to: ['smart-contract-bug']
				})
			]
		}),
		protocol: makeProtocolRiskFixture({
			protocol_id: 'compound-v3',
			audits: [makeAudit({ firm: 'OpenZeppelin' })],
			multisigs: [
				makeMultisig({
					role: 'governance-multisig-owner',
					role_label: 'Governance owner',
					threshold: { m: 4, n: 7 },
					signers: Array.from({ length: 7 }, (_, i) => ({
						address: `0x${String(i).padStart(40, '1')}`
					})),
					depositor_impact: {
						reaches_principal: true,
						gate: 'vault-timelock',
						summary: { value: 'Governance can change market parameters.' }
					}
				})
			],
			governance: makeGovernance({ voting_power_concentration_top10_pct: 0.5 }),
			freshness: makeFreshness({
				drift: [
					{
						id: 'drift-1',
						kind: 'parameter',
						notes: 'Supply cap raised on WETH market.',
						actual: '120M',
						expected: '100M'
					}
				]
			})
		})
	}
}

// A governed MARKET (Aave-style) with unmodeled collateral bad debt: rows read as exposure
// ceilings and the vendor's unresolved on-chain admin gets its own row.
function aaveData(): VaultRiskData {
	const mk = (symbol: string, address: string): CollateralRisk =>
		makeCollateral({
			token: { chain: 'ethereum', symbol, address },
			market_loss_ceiling_usd: 5_000_000,
			vault_allocation_usd: 4_000_000,
			exposure_usd: 4_000_000,
			bad_debt_at_price_zero_usd: null,
			bad_debt_markets: [],
			liquidation_threshold: 0.8,
			aggregate_trust_usd: 8_000_000,
			vault_count: 4,
			oracle_type: 'market',
			oracle_providers: ['Chainlink'],
			exposure_pct: 0.2
		})
	return {
		vault: makeVaultRiskFixture({
			protocol_id: 'aave-v3',
			pool_type: 'market',
			pool_total_supply_usd: 20_000_000,
			pool_total_borrow_usd: 10_000_000,
			available_liquidity_usd: 10_000_000,
			utilization: 0.5,
			last_updated_ts: UPDATED_TS,
			vault_specific_risks: [
				makeScenario({
					id: 'sc-orc',
					scenario_id: 'market-oracle-compromise',
					kind: 'oracle-hack',
					description: 'A compromised feed misprices collateral shared across the market.',
					loss: makeLoss({
						status: 'computed',
						min_usd: 1_000_000,
						max_usd: 1_000_000
					})
				})
			],
			collateral_risks: [
				mk('WETH', '0x0000000000000000000000000000000000000e11'),
				mk('USDe', '0x0000000000000000000000000000000000005de0')
			],
			oracle_exposure: {
				by_provider: [
					{
						provider: 'Chainlink',
						exposure_usd: 8_000_000,
						exposure_pct: 0.4,
						collateral_symbols: ['WETH', 'USDe']
					}
				]
			},
			oracle_dependencies: []
		}),
		protocol: makeProtocolRiskFixture({
			protocol_id: 'aave-v3',
			audits: [makeAudit({ firm: 'Certora' })],
			governance: makeGovernance({ voting_power_concentration_top10_pct: 0.3 })
		})
	}
}

describe('VaultRiskSection render', () => {
	test('returns null when there is no data', async () => {
		expect(await render(<VaultRiskSection data={null} poolName="x" chain="ethereum" />)).toBe('')
	})

	test('shows an honest empty state (not blank) when a covered pool has no scenarios', async () => {
		const d = morphoData()
		d.vault.vault_specific_risks = []
		const html = await render(<VaultRiskSection data={d} poolName="x" chain="ethereum" />)
		expect(html).not.toBe('')
		expect(html).toContain('mapped yet')
		expect(html).toContain('Coverage is rolling out across protocols') // honest, protocol-agnostic copy
		expect(html).toContain('morpho-blue') // protocol chip still rendered
	})

	test('contains an incomplete successful payload at the optional panel boundary', async () => {
		const data = morphoData()
		data.vault.vault_specific_risks = null as never

		const html = await render(<VaultRiskSection data={data} poolName="x" chain="ethereum" />)

		expect(html).toContain('mapped yet')
		expect(html).toContain('Coverage is rolling out across protocols')
	})

	test('shows the protocol-wide drift banner when drift is present (compound-v3)', async () => {
		const html = await render(<VaultRiskSection data={compoundData()} poolName="x" chain="ethereum" />)
		expect(html).toContain('affects all compound-v3 vaults')
	})

	test('renders a market pool with live exit liquidity, vault with the underlying-markets note', async () => {
		const market = await render(<VaultRiskSection data={compoundData()} poolName="x" chain="ethereum" />)
		expect(market).toContain('withdrawable now')
		expect(market).toContain('% utilized')
		// a governed market (Compound) has no vault operators — say so, pointing at governance
		expect(market).toContain('No vault operators')
		expect(market).not.toContain('Immutable market') // Compound markets are governed, not immutable
		const vault = await render(<VaultRiskSection data={morphoData()} poolName="x" chain="ethereum" />)
		expect(vault).toContain('underlying markets')
	})

	async function renderAaveCollateral() {
		const vm = buildVaultRiskVM(aaveData())
		return render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
	}

	test('reads collateral shares as a share of the market on a market pool (aave)', async () => {
		const html = await renderAaveCollateral()
		expect(html).toContain('of market')
		expect(html).not.toContain('of vault')
	})

	test('gives a vendor whose on-chain admin is unresolved its own oracle row (aave)', async () => {
		const html = await renderAaveCollateral()
		expect(text(html)).toContain('Chainlink· on-chain control not resolved')
		expect(html).toContain('mispriceable if this feed lies')
	})

	// Every aave collateral here is bad_debt_basis-unmodeled: never an exposure figure dressed up as bad debt.
	test('reads unmodeled collateral as Not modeled with its exposure ceiling (aave)', async () => {
		const html = await renderAaveCollateral()
		expect(html).toContain('Not modeled')
		expect(html).toContain('exposed')
		expect(html).toContain('Per-collateral exposure ceilings are listed below')
	})

	test('keeps the vendor row when a resolved admin covers only a sliver of its exposure (managed-wrapper gap)', async () => {
		const d = aaveData()
		// USDe-on-Base shape: one resolved admin (the vendor Safe behind small aggregator feeds)
		// carries dust, while most of the vendor's exposure flows through a managed wrapper whose
		// admin is unresolved. The vendor row must survive so the header total stays explained.
		d.vault.oracle_dependencies = [
			{
				admin_address: '0x0000000000000000000000000000000000000adm',
				admin_kind: 'safe',
				multisig: '4/9',
				vendors: ['Chainlink'],
				collateral_symbols: ['WETH'],
				exposure_usd: 0.02,
				exposure_pct: 0.000000001
			}
		]
		const vm = buildVaultRiskVM(d)
		const html = await render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
		expect(html).toContain('a 4/9 Safe multisig') // the resolved admin row still renders
		expect(html).toContain('on-chain control not resolved') // …and so does the $8m vendor row
		// with an admin row covering (nearly) all of the vendor's exposure, the vendor row is deduped
		d.vault.oracle_dependencies[0]!.exposure_usd = 8_000_000
		const vm2 = buildVaultRiskVM(d)
		const html2 = await render(
			<CollateralView
				collateral={vm2.collateral}
				protocolId={vm2.protocolId}
				poolType={vm2.poolType}
				oracleExposure={vm2.oracleExposure}
				oracleDependencies={vm2.oracleDependencies}
				chain={vm2.chain}
			/>
		)
		expect(html2).toContain('a 4/9 Safe multisig')
		expect(html2).not.toContain('on-chain control not resolved')
	})

	test('renders vendorless drainable exposure as explicit rows instead of dropping it (sUSDe / mHYPER shapes)', async () => {
		const d = aaveData()
		// sUSDe shape: immutable ERC4626 exchange rate — no vendor, no admin anywhere.
		Object.assign(d.vault.collateral_risks[0]!, {
			token: {
				chain: 'ethereum',
				symbol: 'sUSDe',
				address: d.vault.collateral_risks[0]!.token.address
			},
			oracle_providers: [],
			feed_kinds: ['exchange-rate'],
			drainable_usd: 3_500_000
		})
		// mHYPER shape: composite feed whose vendor the resolver could not identify.
		Object.assign(d.vault.collateral_risks[1]!, {
			token: {
				chain: 'ethereum',
				symbol: 'mHYPER',
				address: d.vault.collateral_risks[1]!.token.address
			},
			oracle_providers: [],
			feed_kinds: ['composite'],
			drainable_usd: 300_000
		})
		d.vault.oracle_exposure = {
			by_provider: [
				{
					provider: 'none',
					exposure_usd: 3_800_000,
					exposure_pct: 0.19,
					collateral_symbols: ['sUSDe', 'mHYPER']
				}
			]
		}
		d.vault.oracle_dependencies = []
		const vm = buildVaultRiskVM(d)
		const html = await render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				supplyUsd={vm.supplyUsd}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
		// the panel renders at all (previously: no proven vendor + no admins → null, header total orphaned)
		expect(html).toContain('Oracle dependencies')
		// the immutable exchange rate is named for what it is, not "control not resolved"
		expect(html).toContain('On-chain exchange rate')
		expect(html).toContain('no external feed or admin')
		expect(html).toContain('mispriceable only via the issuing contract')
		// the unidentified-vendor gap stays an honest, visible row
		expect(html).toContain('Unidentified feeds')
		expect(html).toContain('vendor and on-chain control not resolved')
	})

	test('aave collateral renders each bad_debt_basis distinctly (precise / approx / confident-zero / unmodeled)', async () => {
		const d = aaveData()
		// confident-zero: a borrow-disabled reserve scanned to exactly $0 bad debt (oracle-drain still real)
		Object.assign(d.vault.collateral_risks[0]!, {
			bad_debt_basis: 'position-scan',
			bad_debt_at_price_zero_usd: 0,
			collateral_borrowed_debt_usd: 0,
			liquidation_threshold: 0.83,
			drainable_usd: 63_000_000
		})
		// precise: a per-position scan with a real figure
		Object.assign(d.vault.collateral_risks[1]!, {
			bad_debt_basis: 'position-scan',
			bad_debt_at_price_zero_usd: 5_000_000,
			bad_debt_markets: [],
			collateral_borrowed_debt_usd: null,
			liquidation_threshold: null,
			vault_allocation_usd: null
		})
		// approximate: a market-wide estimate (RWA / Horizon style)
		d.vault.collateral_risks.push(
			makeCollateral({
				token: {
					chain: 'ethereum',
					symbol: 'wstETH',
					address: '0x0000000000000000000000000000000000005731'
				},
				bad_debt_basis: 'market-wide',
				bad_debt_at_price_zero_usd: 3_000_000,
				bad_debt_markets: [],
				collateral_borrowed_debt_usd: null,
				liquidation_threshold: null,
				vault_allocation_usd: null,
				market_loss_ceiling_usd: 5_000_000,
				exposure_usd: 4_000_000,
				aggregate_trust_usd: 8_000_000,
				vault_count: 4,
				oracle_providers: ['Chainlink'],
				exposure_pct: 0.2
			})
		)
		// a fourth reserve stays unmodeled (bad_debt_at_price_zero_usd null)
		d.vault.collateral_risks.push(
			makeCollateral({
				token: {
					chain: 'ethereum',
					symbol: 'BTCb',
					address: '0x0000000000000000000000000000000000005b7c'
				},
				bad_debt_at_price_zero_usd: null,
				market_loss_ceiling_usd: 5_000_000,
				exposure_usd: 4_000_000,
				aggregate_trust_usd: 8_000_000,
				vault_count: 4,
				oracle_providers: ['Chainlink'],
				exposure_pct: 0.2
			})
		)
		const vm = buildVaultRiskVM(d)
		const html = await render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				supplyUsd={vm.supplyUsd}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
		expect(html).toContain('no bad debt') // confident zero — a real zero, not missing data
		expect(html).toContain('≈') // market-wide estimate, never shown as precise
		expect(html).toContain('Market-wide estimate') // its accordion caveat
		expect(html).toContain('Not modeled') // the unmodeled reserve
		expect(html).toContain('exposed') // unmodeled shows the exposure ceiling as context
	})

	test('collateral view gives each asset its own stress slider (morpho)', async () => {
		const vm = buildVaultRiskVM(morphoData())
		const html = await render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				supplyUsd={vm.supplyUsd}
				marketOracles={vm.marketOracles}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
		// One range input per modelable collateral, none in the header.
		expect(html.match(/type="range"/g)?.length).toBe(2)
		expect(html).toContain('aria-label="Custom weETH collateral price drop"')
		expect(html).toContain('aria-label="Custom cbETH collateral price drop"')
	})

	test('leads collateral detail with the backend oracle mechanism, price-path legs, and a PT pricing tag', async () => {
		const d = morphoData()
		d.vault.oracle_config = d.vault.collateral_risks.map((c) => ({
			type: 'hybrid',
			chain: 'ethereum',
			instance: 'test',
			asset_symbol: c.token.symbol,
			asset_address: c.token.address,
			oracle_address: '0x00000000000000000000000000000000000feed0',
			source_attribution: { value: 'test fixture' },
			mechanism_summary: 'Priced via a weETH/ETH exchange-rate leg plus a Chainlink market-rate quote path.',
			base_leg: 'weETH/ETH exchange-rate adapter',
			quote_leg: 'Chainlink market-rate quote feed path',
			pt_pricing: 'linear_discount'
		}))
		const vm = buildVaultRiskVM(d)
		const html = await render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				supplyUsd={vm.supplyUsd}
				marketOracles={vm.marketOracles}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
		// the asset-specific mechanism is rendered (it was a buried 10px caption; now the lead line)
		expect(html).toContain('weETH/ETH exchange-rate leg plus a Chainlink market-rate quote path')
		// both legs of the price path render as their own labeled rows
		expect(html).toContain('weETH/ETH exchange-rate adapter')
		expect(html).toContain('Chainlink market-rate quote feed path')
		// the PT pricing model surfaces as a tag (linear discount vs market rate at a glance)
		expect(html).toContain('Linear discount')
	})

	test('renders the resolved on-chain oracle legs (description + kind chip + vendor) when served', async () => {
		const d = morphoData()
		d.vault.oracle_config = d.vault.collateral_risks.map((c) => ({
			type: 'market',
			chain: 'ethereum',
			instance: 'test',
			asset_symbol: c.token.symbol,
			asset_address: c.token.address,
			oracle_address: '0x00000000000000000000000000000000000feed0',
			source_attribution: { value: 'test fixture' },
			mechanism_summary: 'Priced via CBETH / ETH × ETH / USD, quoted in USDC / USD — 3-hop market feeds.',
			// legs must win over base_leg/quote_leg as the richer breakdown
			base_leg: 'should not render when legs are present',
			quote_leg: 'should not render when legs are present',
			legs: [
				{
					slot: 'base1',
					description: 'CBETH / ETH',
					vendor: 'Chainlink',
					kind: 'market'
				},
				{
					slot: 'base2',
					description: 'ETH / USD',
					vendor: 'Chainlink',
					kind: 'market'
				},
				{
					slot: 'quote1',
					description: 'USDC / USD',
					vendor: 'Chainlink',
					kind: 'nav'
				}
			]
		}))
		const vm = buildVaultRiskVM(d)
		const html = await render(
			<CollateralView
				collateral={vm.collateral}
				protocolId={vm.protocolId}
				poolType={vm.poolType}
				supplyUsd={vm.supplyUsd}
				marketOracles={vm.marketOracles}
				oracleExposure={vm.oracleExposure}
				oracleDependencies={vm.oracleDependencies}
				chain={vm.chain}
			/>
		)
		// every leg's on-chain description renders, in order
		expect(html).toContain('CBETH / ETH')
		expect(html).toContain('ETH / USD')
		expect(html).toContain('USDC / USD')
		// the kind classification chip lets a reader tell a market hop from a NAV/redemption leg
		expect(html).toContain('NAV')
		// the richer legs view supersedes the base/quote fallback text
		expect(html).not.toContain('should not render when legs are present')
	})

	test('renders the oracle full-drain detail as a drainable-now → if-forced range with the admin inline', async () => {
		const d = morphoData()
		const weETH = d.vault.collateral_risks[0]!.token
		const cbETH = d.vault.collateral_risks[1]!.token
		d.vault.vault_specific_risks.push(
			makeScenario({
				id: 'sc-fulldrain-weeth',
				scenario_id: 'oracle-compromise-full-drain',
				kind: 'oracle-hack',
				title: 'Oracle compromise (full drain)',
				asset: weETH,
				description:
					'If this managed oracle is compromised, the feed can be forced and the whole position borrowed out.',
				loss: makeLoss({
					status: 'computed',
					min_usd: 500_000,
					max_usd: 2_000_000,
					window_type: 'event',
					time_window_sec: { min: 0, max: 0 }
				}),
				oracle_admins: [
					{
						address: '0x00000000000000000000000000000000000000d1',
						kind: 'safe',
						threshold: 4,
						signers: 9
					}
				]
			}),
			makeScenario({
				id: 'sc-fulldrain-cbeth',
				scenario_id: 'oracle-compromise-full-drain',
				kind: 'oracle-hack',
				title: 'Oracle compromise (full drain)',
				asset: cbETH,
				description:
					'If this managed oracle is compromised, the feed can be forced and the whole position borrowed out.',
				loss: makeLoss({
					status: 'computed',
					min_usd: 200_000,
					max_usd: 800_000,
					window_type: 'event',
					time_window_sec: { min: 0, max: 0 }
				}),
				// no threshold/signers → a bare single-key control, toned as the weaker admin
				oracle_admins: [
					{
						address: '0x00000000000000000000000000000000000000d2',
						kind: 'eoa'
					}
				]
			})
		)
		const vm = buildVaultRiskVM(d)
		const scenario = vm.scenarios.find((s) => s.scenarioId === 'oracle-compromise-full-drain')!
		const html = await render(
			<ScenarioDetailContent scenario={scenario} protocol={vm.protocol} supplyUsd={vm.supplyUsd} />
		)
		// the two-figure range: what's drainable now vs the whole position if the feed is forced
		expect(html).toContain('Drainable now')
		expect(html).toContain('If the oracle is forced')
		// the plausibility clause names the resolved multisig strength and the single-key case
		expect(html).toContain('if this 4-of-9 Safe is compromised')
		expect(html).toContain('if this single key (EOA) is compromised')
		// framed as a conditional worst case, never an expected loss
		expect(html).toContain('conditional worst case')
	})

	test('omits the controlling-admin clause on a full-drain row whose admin was not resolved this tick', async () => {
		const d = morphoData()
		d.vault.vault_specific_risks.push(
			makeScenario({
				id: 'sc-fulldrain-unresolved',
				scenario_id: 'oracle-compromise-full-drain',
				kind: 'oracle-hack',
				title: 'Oracle compromise (full drain)',
				asset: d.vault.collateral_risks[0]!.token,
				description: 'A managed oracle can be forced to any price, letting an attacker borrow out the whole position.',
				loss: makeLoss({
					status: 'computed',
					min_usd: 500_000,
					max_usd: 2_000_000,
					window_type: 'event',
					time_window_sec: { min: 0, max: 0 }
				})
				// oracle_admins intentionally absent
			})
		)
		const vm = buildVaultRiskVM(d)
		const scenario = vm.scenarios.find((s) => s.scenarioId === 'oracle-compromise-full-drain')!
		const html = await render(
			<ScenarioDetailContent scenario={scenario} protocol={vm.protocol} supplyUsd={vm.supplyUsd} />
		)
		expect(html).toContain('If the oracle is forced') // the range still renders
		expect(html).not.toContain('is compromised') // …but no "controlled by" implication
	})

	test('trust panel shows a pending-change countdown when queued', async () => {
		const vm = buildVaultRiskVM(morphoData())
		const html = await render(
			<TrustPanel
				protocol={vm.protocol}
				vaultRoles={vm.vaultRoles}
				vaultDependencies={vm.vaultExternalDependencies}
				nowIso="2026-06-19T00:00:00Z"
			/>
		)
		// The queued cap change lands at valid_at, two days after nowIso: the reader's window to exit.
		expect(text(html)).toContain('Set supply cap— applies in 2 days; time to exit first')
	})

	test('titles the section with vault_name and shows the disambiguating contract address', async () => {
		const data = morphoData()
		data.vault.vault_name = 'Steakhouse Prime USDC'
		data.vault.vault_address = '0x00000000000000000000000000000000000000ab'
		const html = await render(<VaultRiskSection data={data} poolName="STEAKUSDC" chain="ethereum" />)
		expect(html).toContain('Depositing into Steakhouse Prime USDC') // brand name over the yields symbol
		expect(html).toContain('0x0000…00ab') // same name can run V1+V2 vaults — the contract chip disambiguates

		// null vault_name/address (market rows, non-morpho, first post-deploy tick) → symbol, no chip
		const plain = await render(<VaultRiskSection data={morphoData()} poolName="STEAKUSDC" chain="ethereum" />)
		expect(plain).toContain('Depositing into STEAKUSDC')
		expect(plain).not.toContain('0x0000…00ab')

		// standalone /risk page: its header already names chain + contract — the shell must not repeat them
		const alone = await render(<VaultRiskSection data={data} poolName="STEAKUSDC" chain="ethereum" standalone />)
		expect(alone).not.toContain('0x0000…00ab')
		expect(alone).toContain('Morpho Blue') // protocol + pool type chips stay: they're not in the header
	})

	test('sentinels fill the veto slot: listed like allocators, capability joined by role, no unguarded state', async () => {
		// newer Morpho vaults appoint sentinels instead of a guardian — same veto role, several holders
		const roles = makeVaultRoles({
			curator: makeRoleEntity({
				kind: 'safe',
				address: '0x00000000000000000000000000000000000000c1'
			}),
			guardian: null,
			sentinels: [
				makeRoleEntity({
					kind: 'safe',
					address: '0x00000000000000000000000000000000000000f1',
					threshold: { m: 3, n: 5 }
				}),
				makeRoleEntity({
					kind: 'eoa',
					address: '0x00000000000000000000000000000000000000f2'
				})
			]
		})
		const protocol = makeProtocolRiskFixture({
			role_capabilities: [
				{
					role: 'sentinel',
					role_label: 'Sentinel',
					reaches_principal: false,
					gate: 'veto-only',
					summary: 'Cancels queued curator changes and de-risks allocations.'
				}
			]
		})
		const html = await render(<TrustPanel protocol={protocol} vaultRoles={roles} nowIso="2026-06-19T00:00:00Z" />)
		expect(html).toContain('Sentinels') // the many-holder veto row
		expect(html).toContain('1 multisig · 1 EOA') // collapsed line summarizes the holders
		expect(html).toContain('Safety role · veto only') // capability marker joined on role: 'sentinel'
		expect(html).toContain('Cancels queued curator changes') // authored summary, not the static fallback
		// sentinels ARE the veto role — the guardian-absence danger state must not fire
		expect(html).not.toContain('none appointed')
		expect(html).not.toContain('No veto — unguarded')
	})

	test('keys the unguarded state on guardian null AND sentinels empty', async () => {
		const roles = makeVaultRoles({
			curator: makeRoleEntity({
				kind: 'safe',
				address: '0x00000000000000000000000000000000000000c1'
			}),
			guardian: null,
			sentinels: []
		})
		const html = await render(
			<TrustPanel protocol={makeProtocolRiskFixture()} vaultRoles={roles} nowIso="2026-06-19T00:00:00Z" />
		)
		expect(html).toContain('none appointed') // the guardian row renders its absence…
		expect(html).toContain('No veto — unguarded') // …with the danger marker
		expect(html).not.toContain('Sentinels')
	})

	test('leads with one loss figure bound to its cause, in % of deposit', async () => {
		const html = await render(<VaultRiskSection data={morphoData()} poolName="x" chain="ethereum" />)
		// One hero figure with its condition in plain language, then the ceiling as a sentence:
		// the crash loses 1.8m of a 10m deposit at −50%, the contract bug takes all of it.
		expect(text(html)).toContain('18%of your deposit if collateral falls 50%')
		expect(text(html)).toContain('Only representative failure reaches a total 100%, with no warning to exit.')
	})

	test('frames scenario losses as % of deposit, qualified by the crash depth each was modeled at', async () => {
		// the smart-contract-bug at full supply reads 100% of deposit; price-driven rows carry the
		// depth as a qualifier so the figure is readable without a page-level drop selector.
		const html = await render(<VaultRiskSection data={morphoData()} poolName="x" chain="ethereum" />)
		expect(html).toContain('Loss at −30%') // the column states the depth, so cells don't repeat it
		expect(rowCells(html, 'scenario-smart-contract-bug')).toEqual([
			'Representative failure',
			'100%',
			'Full deposit',
			'Instant',
			''
		])
		// 900k of 10m at the −30% column depth, 1.8m at the worst modeled depth.
		expect(rowCells(html, 'scenario-wide-crypto-drop')).toEqual([
			'Wide crypto crash',
			'9%',
			'up to 18%',
			'1 day – 7 days',
			''
		])
	})

	test('survives collateral_risks with no liquidity_scenario (API may omit it) — no blank section', async () => {
		// Regression: the public API projection can drop collateral_risks[].liquidity_scenario. The FE must
		// not read it unguarded (it did, and threw → the whole section fell back to the empty state).
		const d = morphoData()
		for (const c of d.vault.collateral_risks) delete (c as { liquidity_scenario?: unknown }).liquidity_scenario
		const vm = buildVaultRiskVM(d)
		expect(vm.collateral.length).toBe(d.vault.collateral_risks.length)
		expect(vm.scenarios.length).toBeGreaterThan(0)
		const html = await render(<VaultRiskSection data={d} poolName="x" chain="ethereum" />)
		expect(html).toContain('How much could be lost?') // the hero, not the empty state
		expect(html).not.toContain("aren't mapped yet")
	})

	test('surfaces data_gap scenarios in their own group instead of hiding them (honest about gaps)', async () => {
		// a data_gap scenario (no sized loss) must still appear under the "Not quantified" group rather
		// than being silently dropped.
		const d = aaveData()
		d.vault.vault_specific_risks.push(
			makeScenario({
				id: 'sc-gap',
				scenario_id: 'wide-crypto-drop',
				title: 'Wide crypto crash',
				kind: 'macro',
				description: 'A broad crash whose impact cannot be sized from on-chain inputs yet.',
				loss: makeLoss({ status: 'data_gap', min_usd: 0, max_usd: 0 })
			})
		)
		const html = await render(<VaultRiskSection data={d} poolName="x" chain="ethereum" />)
		expect(html).toContain('Not quantified') // group header + the muted loss cell
		expect(html).toContain('Wide crypto crash') // the data_gap scenario, shown
	})

	test('lists each scenario under its group header', async () => {
		const html = await render(<VaultRiskSection data={morphoData()} poolName="x" chain="ethereum" />)
		const order = [...html.matchAll(/<tr id="(scenario-[^"]+)"|<td colSpan="5"[^>]*><span[^>]*>([^<]+)<\/span>/g)].map(
			([, rowId, header]) => rowId ?? text(header!)
		)
		expect(order).toEqual([
			'Full-deposit & protocol-level',
			'scenario-smart-contract-bug',
			'Price-driven collateral stress',
			'scenario-wide-crypto-drop',
			'Oracle & liquidation failures',
			'scenario-market-oracle-compromise'
		])
	})

	test('renders protocol-wide incidents in their own labeled lane, off the pool track record (morpho)', async () => {
		// a Morpho pool's protocol.incidents show as Morpho-wide history, framed as "not recorded on this
		// vault" — never folded into the pool's own losses.
		const html = await render(<VaultRiskSection data={morphoData()} poolName="x" chain="ethereum" />)
		expect(html).toContain('pool-level losses') // the pool's own (empty) record, said as pool-level
		expect(html).toContain('protocol incident') // the protocol-wide lane summary
		expect(html).toContain('not recorded on this vault') // the honest framing on each protocol dot
	})
})

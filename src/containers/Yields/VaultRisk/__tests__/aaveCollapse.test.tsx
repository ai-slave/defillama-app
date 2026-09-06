import type { ReactElement } from 'react'
import { prerenderToNodeStream } from 'react-dom/static.node'
import { describe, expect, test } from 'vitest'
import { CollateralView } from '../components/CollateralView'
import { ScenarioByExit } from '../components/ScenarioByExit'
import { ScenarioDetailContent } from '../components/ScenarioDetailPanel'
import { buildVaultRiskVM } from '../derive'
import type { TokenRef, VaultRiskData, VaultRiskFixture, VaultScenario } from '../types'
import { makeCollateral, makeCoverage, makeLoss, makeScenario, makeVaultRiskData } from './factories'

// Validates the FE against the collapsed Aave payload (per-collateral scenario families now
// arrive as ONE aggregate row each): replay the collapse transform, prove the VM is unchanged.

async function render(el: ReactElement): Promise<string> {
	const { prelude } = await prerenderToNodeStream(el)
	const chunks: Array<Buffer> = []
	for await (const chunk of prelude) chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks).toString('utf8')
}

const COLLAPSED_IDS = [
	'risk-steward-abuse',
	'oracle-malfunction-single-asset',
	'oracle-staleness',
	'capo-oracle-misconfig',
	'asset-listing-misconfig'
] as const

// Served titles (the API now authors these; fixtures mirror the payload).
const SCENARIO_TITLE: Record<(typeof COLLAPSED_IDS)[number], string> = {
	'risk-steward-abuse': 'Risk Steward abuse',
	'oracle-malfunction-single-asset': 'Oracle malfunction (single asset)',
	'oracle-staleness': 'Oracle staleness',
	'capo-oracle-misconfig': 'Oracle misconfiguration (CAPO)',
	'asset-listing-misconfig': 'Asset listing misconfiguration'
}

// One fanned per-asset row of a family — the shape the deriver groups into perAsset and the
// collapse transform folds away.
function makeFannedRow(scenarioId: keyof typeof SCENARIO_TITLE, asset: TokenRef, maxUsd: number): VaultScenario {
	return makeScenario({
		id: `${scenarioId}::${asset.symbol}`,
		scenario_id: scenarioId,
		title: SCENARIO_TITLE[scenarioId],
		kind: 'oracle-malfunction',
		asset,
		loss: makeLoss({ basis: 'derived', status: 'computed', max_usd: maxUsd, min_usd: 0, window_type: 'event' })
	})
}

// Three synthetic collaterals; the family losses are hand-picked per asset so every derived
// quantity is trivially checkable: family sum = 100+200+300 = 600, max-single = 300, count = 3.
const ASSETS: Array<TokenRef> = [
	{ chain: 'ethereum', symbol: 'AAA', address: '0x00000000000000000000000000000000000000aa' },
	{ chain: 'ethereum', symbol: 'BBB', address: '0x00000000000000000000000000000000000000bb' },
	{ chain: 'ethereum', symbol: 'CCC', address: '0x00000000000000000000000000000000000000cc' }
]
const PER_ASSET_LOSS = [100, 200, 300]

function makeSyntheticAave(): VaultRiskData {
	// Each collapsed family is fanned across the three assets with the same loss vector.
	const fanned: Array<VaultScenario> = COLLAPSED_IDS.flatMap((id) =>
		ASSETS.map((asset, i) => makeFannedRow(id, asset, PER_ASSET_LOSS[i]!))
	)
	// One passthrough scenario that is NOT collapsed — proves passthrough rows survive untouched
	// and gives the section a distinct non-fanned family. Bigger loss so it's the worst case.
	const passthrough = makeScenario({
		id: 'gov-capture',
		scenario_id: 'gov-capture',
		kind: 'governance',
		loss: makeLoss({ basis: 'manual', status: 'computed', max_usd: 5000, min_usd: 5000, window_type: 'exit' })
	})

	return makeVaultRiskData(
		{
			pool_type: 'market',
			// large enough that no scenario loss is clamped to supply (keeps headline hand-derivable)
			pool_total_supply_usd: 10_000_000,
			available_liquidity_usd: 9_000_000,
			utilization: 0.1,
			vault_specific_risks: [passthrough, ...fanned],
			// two collaterals so the collateral-tab test has >1 row; distinct exposure avoids dust
			collateral_risks: [
				makeCollateral({
					token: ASSETS[0]!,
					exposure_usd: 500_000,
					market_loss_ceiling_usd: 500_000,
					aggregate_trust_usd: 12_000_000
				}),
				makeCollateral({
					token: ASSETS[1]!,
					exposure_usd: 250_000,
					market_loss_ceiling_usd: 250_000,
					aggregate_trust_usd: 8_000_000
				})
			],
			// coverage that names the worst-case (gov-capture) so the headline coverage total is non-trivial
			coverage: [
				makeCoverage({ kind: 'treasury', access: 'gov_vote', cap_usd: 3000, priority: 1, applies_to: ['gov-capture'] })
			]
		},
		{}
	)
}

// The backend transform, replayed: fold the per-asset rows of each family into a single
// asset-less row; sum semantics preserve the current headline.
function collapseAave(vault: VaultRiskFixture): VaultRiskFixture {
	const agg = new Set<string>(COLLAPSED_IDS)
	const groups = new Map<string, Array<VaultScenario>>()
	const passthrough: Array<VaultScenario> = []
	for (const s of vault.vault_specific_risks) {
		if (!agg.has(s.scenario_id)) {
			passthrough.push(s)
			continue
		}
		const arr = groups.get(s.scenario_id)
		if (arr) arr.push(s)
		else groups.set(s.scenario_id, [s])
	}
	const aggregated: Array<VaultScenario> = []
	for (const [, rows] of groups) {
		const computed = rows.filter((r) => r.loss.status === 'computed')
		const sumMax = computed.reduce((a, r) => a + (r.loss.max_usd || 0), 0)
		const sumMin = computed.reduce((a, r) => a + (r.loss.min_usd || 0), 0)
		let maxSingle = 0
		for (const r of computed) maxSingle = Math.max(maxSingle, r.loss.max_usd || 0)
		const { asset: _drop, ...head } = rows[0]!
		aggregated.push({
			...head,
			loss: {
				...head.loss,
				max_usd: sumMax,
				min_usd: sumMin,
				inputs: {
					asset_count: rows.length,
					sum_collateral_loss_usd: sumMax,
					max_single_collateral_loss_usd: maxSingle
				}
			}
		})
	}
	return { ...vault, vault_specific_risks: [...passthrough, ...aggregated] }
}

describe('Aave collapsed scenario payload', () => {
	const original = makeSyntheticAave()
	const collapsed: VaultRiskData = { ...original, vault: collapseAave(original.vault) }
	const before = buildVaultRiskVM(original)
	const after = buildVaultRiskVM(collapsed)

	test('sanity: the source fixture actually carries per-asset rows for all five families', () => {
		for (const id of COLLAPSED_IDS) {
			const rows = original.vault.vault_specific_risks.filter((s) => s.scenario_id === id)
			expect(rows.length).toBeGreaterThan(1)
			expect(rows.every((r) => r.asset)).toBe(true)
			// and the collapsed payload emits exactly one asset-less row per family
			const out = collapsed.vault.vault_specific_risks.filter((s) => s.scenario_id === id)
			expect(out).toHaveLength(1)
			expect(out[0]!.asset).toBeUndefined()
		}
	})

	test('headline loss is unchanged vs the previous grouped-sum semantics', () => {
		// The deriver already summed the per-asset rows into one ScenarioVM per id, so a server-side
		// sum must reproduce the same per-scenario loss and the same section headline exactly.
		expect(after.scenarios.length).toBe(before.scenarios.length)
		for (const id of COLLAPSED_IDS) {
			const b = before.scenarios.find((s) => s.scenarioId === id)!
			const a = after.scenarios.find((s) => s.scenarioId === id)!
			expect(a.lossMaxUsd).toBe(b.lossMaxUsd)
			expect(a.lossMinUsd).toBe(b.lossMinUsd)
			expect(a.status).toBe(b.status)
			expect(a.magnitudePct).toBeCloseTo(b.magnitudePct, 10)
		}
		expect(after.headline.worstCaseMaxUsd).toBe(before.headline.worstCaseMaxUsd)
		expect(after.headline.uncoveredMaxUsd).toBe(before.headline.uncoveredMaxUsd)
		expect(after.headline.coverageTotalUsd).toBe(before.headline.coverageTotalUsd)
	})

	test('drops perAsset and replaces inputs with the three transparency fields', () => {
		for (const id of COLLAPSED_IDS) {
			const b = before.scenarios.find((s) => s.scenarioId === id)!
			const a = after.scenarios.find((s) => s.scenarioId === id)!
			expect(b.perAsset?.length).toBeGreaterThan(0) // before: a per-asset breakdown existed
			expect(a.perAsset).toBeUndefined() // after: none — the collapsed row has no assets
			expect(a.inputs.asset_count).toBe(b.perAsset!.length)
			expect(a.inputs.sum_collateral_loss_usd).toBeGreaterThan(0)
			expect(a.inputs.max_single_collateral_loss_usd).toBeGreaterThan(0)
			// the sum is the family total; the max-single never exceeds it
			expect(a.inputs.max_single_collateral_loss_usd!).toBeLessThanOrEqual(a.inputs.sum_collateral_loss_usd!)
		}
	})

	test('scenario table still renders every family as a single row', async () => {
		const html = await render(
			<ScenarioByExit scenarios={after.scenarios} protocol={after.protocol} supplyUsd={after.supplyUsd} />
		)
		expect(html).toContain('Oracle staleness')
		expect(html).toContain('Risk Steward abuse')
		expect(html).toContain('Asset listing misconfiguration')
	})

	test('expanded scenario detail does not crash without perAsset, and shows the math inputs', async () => {
		const staleness = after.scenarios.find((s) => s.scenarioId === 'oracle-staleness')!
		const html = await render(
			<ScenarioDetailContent
				scenario={staleness}
				protocol={after.protocol}
				supplyUsd={after.supplyUsd}
				layout="two-column"
			/>
		)
		expect(html.length).toBeGreaterThan(200)
		expect(html).toContain('asset_count')
		expect(html).toContain('sum_collateral_loss_usd')
		expect(html).toContain('max_single_collateral_loss_usd')
		expect(html).not.toContain('Loss by asset') // the per-asset breakdown is gone, cleanly
	})

	test('collateral tab still provides the per-asset detail (collateral_risks untouched)', async () => {
		const html = await render(
			<CollateralView
				collateral={after.collateral}
				protocolId={after.protocolId}
				poolType={after.poolType}
				supplyUsd={after.supplyUsd}
				oracleExposure={after.oracleExposure}
				oracleDependencies={after.oracleDependencies}
				chain={after.chain}
			/>
		)
		// same collateral set as before — the per-asset surface is unaffected by the scenario collapse
		expect(after.collateral.length).toBe(before.collateral.length)
		expect(after.collateral.length).toBeGreaterThan(1)
		expect(html).toContain(after.collateral[0]!.symbol)
	})
})

import type { ReactElement } from 'react'
import { prerenderToNodeStream } from 'react-dom/static.node'
import { describe, expect, test } from 'vitest'
import { ScenarioByExit } from '../components/ScenarioByExit'
import { ScenarioDetailContent } from '../components/ScenarioDetailPanel'
import { buildVaultRiskVM } from '../derive'
import type { VaultRiskData, VaultScenario } from '../types'
import { makeCoverage, makeLoss, makeScenario, makeVaultRiskData } from './factories'

// The Aave payload serves each per-collateral scenario family as ONE asset-less aggregate row.

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

// Each family folds three collaterals losing 100, 200 and 300: sum 600, max single 300.
function makeCollapsedRow(scenarioId: keyof typeof SCENARIO_TITLE): VaultScenario {
	return makeScenario({
		id: scenarioId,
		scenario_id: scenarioId,
		title: SCENARIO_TITLE[scenarioId],
		kind: 'oracle-malfunction',
		loss: makeLoss({
			basis: 'derived',
			status: 'computed',
			max_usd: 600,
			min_usd: 0,
			window_type: 'event',
			inputs: { asset_count: 3, sum_collateral_loss_usd: 600, max_single_collateral_loss_usd: 300 }
		})
	})
}

function makeCollapsedAave(): VaultRiskData {
	// A bigger, non-collapsed scenario is the worst case, and coverage names it.
	const govCapture = makeScenario({
		id: 'gov-capture',
		scenario_id: 'gov-capture',
		kind: 'governance',
		loss: makeLoss({ basis: 'manual', status: 'computed', max_usd: 5000, min_usd: 5000, window_type: 'exit' })
	})

	return makeVaultRiskData(
		{
			pool_type: 'market',
			// Large enough that no scenario loss is clamped to supply.
			pool_total_supply_usd: 10_000_000,
			available_liquidity_usd: 9_000_000,
			utilization: 0.1,
			vault_specific_risks: [govCapture, ...COLLAPSED_IDS.map(makeCollapsedRow)],
			coverage: [
				makeCoverage({ kind: 'treasury', access: 'gov_vote', cap_usd: 3000, priority: 1, applies_to: ['gov-capture'] })
			]
		},
		{}
	)
}

describe('Aave collapsed scenario payload', () => {
	const vm = buildVaultRiskVM(makeCollapsedAave())
	const family = (id: string) => vm.scenarios.find((s) => s.scenarioId === id)!

	test('keeps every asset-less family as a scenario with its summed loss', () => {
		for (const id of COLLAPSED_IDS) {
			expect([family(id).lossMaxUsd, family(id).lossMinUsd, family(id).status]).toEqual([600, 0, 'computed'])
		}
		expect(vm.headline.worstCaseMaxUsd).toBe(5000)
		expect(vm.headline.coverageTotalUsd).toBe(3000)
		expect(vm.headline.uncoveredMaxUsd).toBe(2000)
	})

	test('serves the three transparency inputs in place of a per-asset breakdown', () => {
		for (const id of COLLAPSED_IDS) {
			expect(family(id).perAsset).toBeUndefined()
			expect(family(id).inputs).toEqual({
				asset_count: 3,
				sum_collateral_loss_usd: 600,
				max_single_collateral_loss_usd: 300
			})
		}
	})

	test('renders every family as exactly one scenario row', async () => {
		const html = await render(
			<ScenarioByExit scenarios={vm.scenarios} protocol={vm.protocol} supplyUsd={vm.supplyUsd} />
		)
		for (const id of COLLAPSED_IDS) {
			expect(html.split(`>${SCENARIO_TITLE[id]}<`).length - 1).toBe(1)
		}
	})

	test('shows the math inputs in the expanded detail, with no per-asset table', async () => {
		const html = await render(
			<ScenarioDetailContent
				scenario={family('oracle-staleness')}
				protocol={vm.protocol}
				supplyUsd={vm.supplyUsd}
				layout="two-column"
			/>
		)
		const inputs = [...html.matchAll(/<dt[^>]*>([^<]+)<\/dt><dd[^>]*>([^<]+)<\/dd>/g)].map(([, key, value]) => [
			key,
			value
		])
		expect(inputs).toEqual([
			['asset_count', '3'],
			['sum_collateral_loss_usd', '600'],
			['max_single_collateral_loss_usd', '300']
		])
		expect(html).not.toContain('Loss by asset')
	})
})

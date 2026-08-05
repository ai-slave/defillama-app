import { describe, expect, it } from 'vitest'
import type { IRWAAssetsOverview, IRWAFlowOverviewSplitPoint } from '../api.types'
import { getRWAFlowRotationSeriesNames } from '../flows'
import {
	aggregateRWAFlowTreemapWindow,
	buildRWAFlowTreemap,
	buildRWAFlowTreemapSizeRowsFromAssets,
	buildRWAFlowTreemapWindowData
} from '../flowTreemap'

const DAY = 86_400

describe('RWA flow treemap', () => {
	it('uses the latest day for daily and trailing windows for longer periods', () => {
		const points: IRWAFlowOverviewSplitPoint[] = [
			{ timestamp: 100 * DAY, Bonds: 4 },
			{ timestamp: 106 * DAY, Bonds: 10, Credit: -2 },
			{ timestamp: 107 * DAY, Bonds: -3 }
		]

		expect(Object.fromEntries(aggregateRWAFlowTreemapWindow(points, 'daily'))).toEqual({ Bonds: -3 })
		expect(Object.fromEntries(aggregateRWAFlowTreemapWindow(points, 'weekly'))).toEqual({ Bonds: 7, Credit: -2 })
		expect(Object.fromEntries(aggregateRWAFlowTreemapWindow(points, 'cumulative'))).toEqual({
			Bonds: 11,
			Credit: -2
		})
	})

	it('shares one flow analysis across window values and recent-flow ordering', () => {
		const latest = 1_800_000_000
		const points: IRWAFlowOverviewSplitPoint[] = [
			{ timestamp: latest - 40 * DAY, 'No Recent Flow': 10_000 },
			{ timestamp: latest - 20 * DAY, 'Monthly Flow': 1_000 },
			{ timestamp: latest - 5 * DAY, 'Weekly Flow': 50 },
			{ timestamp: latest, 'Recent Inflow': 80, 'Recent Outflow': -100 }
		]

		for (const groupBy of ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'cumulative'] as const) {
			const result = buildRWAFlowTreemapWindowData(points, groupBy)
			expect(Object.fromEntries(result.flows)).toEqual(
				Object.fromEntries(aggregateRWAFlowTreemapWindow(points, groupBy))
			)
			expect(result.orderedNames).toEqual(getRWAFlowRotationSeriesNames(points))
		}

		expect(buildRWAFlowTreemapWindowData(points, 'weekly').orderedNames).toEqual([
			'Recent Outflow',
			'Recent Inflow',
			'Weekly Flow',
			'Monthly Flow',
			'No Recent Flow'
		])
	})

	it('sizes by the selected metric and preserves missing flow separately from zero', () => {
		const result = buildRWAFlowTreemap({
			flows: aggregateRWAFlowTreemapWindow([{ timestamp: 1, Bonds: 0, Credit: -20 }], 'daily'),
			sizeRows: [
				{ name: 'Bonds', onChainMcap: 100, activeMcap: 80, defiActiveTvl: 10 },
				{ name: 'Credit', onChainMcap: 50, activeMcap: 40, defiActiveTvl: 5 },
				{ name: 'Missing', onChainMcap: 25, activeMcap: 20, defiActiveTvl: 0 },
				{ name: 'No size', onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0 }
			],
			sizeMetric: 'onChainMcap'
		})

		expect(result.nodes).toEqual([
			{ name: 'Bonds', value: [100, 0], netFlowUsd: 0 },
			{ name: 'Credit', value: [50, -40], netFlowUsd: -20 },
			{ name: 'Missing', value: [25, null], netFlowUsd: null }
		])
		expect(result.excludedSizeCount).toBe(1)
	})

	it('builds asset-group, category, platform, and chain size rows with matching attribution', () => {
		const assets = [
			{
				kind: 'spot',
				assetGroup: 'Treasury Funds',
				category: ['Treasuries'],
				parentPlatform: 'Platform A',
				onChainMcap: {
					total: 100,
					breakdown: [
						['Ethereum', 70],
						['Solana', 30]
					]
				},
				activeMcap: {
					total: 80,
					breakdown: [
						['Ethereum', 60],
						['Solana', 20]
					]
				},
				defiActiveTvl: { total: 10 },
				defiActiveTvlByChain: {
					breakdown: [
						['Ethereum', 8],
						['Solana', 2]
					]
				}
			}
		] as IRWAAssetsOverview['assets']

		expect(buildRWAFlowTreemapSizeRowsFromAssets(assets, 'assetGroup')).toEqual([
			{ name: 'Treasury Funds', activeMcap: 80, onChainMcap: 100, defiActiveTvl: 10 }
		])
		expect(buildRWAFlowTreemapSizeRowsFromAssets(assets, 'category')[0]).toMatchObject({ name: 'Treasuries' })
		expect(buildRWAFlowTreemapSizeRowsFromAssets(assets, 'platform')).toEqual([
			{ name: 'Platform A', activeMcap: 80, onChainMcap: 100, defiActiveTvl: 10 }
		])
		expect(buildRWAFlowTreemapSizeRowsFromAssets(assets, 'chain')).toEqual([
			{ name: 'Ethereum', activeMcap: 60, onChainMcap: 70, defiActiveTvl: 8 },
			{ name: 'Solana', activeMcap: 20, onChainMcap: 30, defiActiveTvl: 2 }
		])
	})
})

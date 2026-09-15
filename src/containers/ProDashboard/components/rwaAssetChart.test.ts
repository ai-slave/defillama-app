import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import { buildProRwaAssetChartSeries, projectRwaAssetDatasetToMetrics } from './rwaAssetChart'

describe('Pro RWA asset chart series', () => {
	const dataset: RWAPositionalChartDataset = {
		dimensions: ['timestamp', 'DeFi Active TVL', 'Active AUM', 'Onchain AUM'],
		source: [[1, 2, 3, 4]]
	}

	test('uses canonical dataset order and visible-series colors for the default metrics', () => {
		const source = dataset.source

		expect(buildProRwaAssetChartSeries(dataset, ['activeMcap', 'onChainMcap', 'defiActiveTvl'])).toEqual([
			{
				type: 'line',
				name: 'DeFi Active TVL',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0]
			},
			{
				type: 'line',
				name: 'Active AUM',
				encode: { x: 0, y: 2 },
				color: CHART_COLORS[1]
			},
			{
				type: 'line',
				name: 'Onchain AUM',
				encode: { x: 0, y: 3 },
				color: CHART_COLORS[2]
			}
		])
		expect(dataset.source).toBe(source)
	})

	test('restarts colors for one- and two-metric subsets without projecting rows', () => {
		expect(buildProRwaAssetChartSeries(dataset, ['activeMcap'])).toEqual([
			{
				type: 'line',
				name: 'Active AUM',
				encode: { x: 0, y: 2 },
				color: CHART_COLORS[0]
			}
		])
		expect(buildProRwaAssetChartSeries(dataset, ['onChainMcap', 'defiActiveTvl'])).toEqual([
			{
				type: 'line',
				name: 'DeFi Active TVL',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0]
			},
			{
				type: 'line',
				name: 'Onchain AUM',
				encode: { x: 0, y: 3 },
				color: CHART_COLORS[1]
			}
		])
	})
})

test('projects CSV rows in dataset order with timestamps', () => {
	expect(
		projectRwaAssetDatasetToMetrics(
			{ dimensions: ['timestamp', 'DeFi Active TVL', 'Active AUM', 'Onchain AUM'], source: [[1, 2, 3, 4]] },
			['onChainMcap', 'defiActiveTvl']
		)
	).toEqual({ dimensions: ['timestamp', 'DeFi Active TVL', 'Onchain AUM'], source: [[1, 2, 4]] })
})

import { describe, expect, it } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import { buildProRwaAssetChartSeries } from './rwaAssetChart'

describe('Pro RWA asset chart series', () => {
	const dataset: RWAPositionalChartDataset = {
		dimensions: ['timestamp', 'DeFi Active TVL', 'Active Mcap', 'Onchain Mcap'],
		source: [[1, 2, 3, 4]]
	}

	it('uses canonical dataset order and visible-series colors for the default metrics', () => {
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
				name: 'Active Mcap',
				encode: { x: 0, y: 2 },
				color: CHART_COLORS[1]
			},
			{
				type: 'line',
				name: 'Onchain Mcap',
				encode: { x: 0, y: 3 },
				color: CHART_COLORS[2]
			}
		])
		expect(dataset.source).toBe(source)
	})

	it('restarts colors for one- and two-metric subsets without projecting rows', () => {
		expect(buildProRwaAssetChartSeries(dataset, ['activeMcap'])).toEqual([
			{
				type: 'line',
				name: 'Active Mcap',
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
				name: 'Onchain Mcap',
				encode: { x: 0, y: 3 },
				color: CHART_COLORS[1]
			}
		])
	})
})

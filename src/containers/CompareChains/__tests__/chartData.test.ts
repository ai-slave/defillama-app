import { describe, expect, test } from 'vitest'
import { buildCompareChainsChartData } from '../index'

describe('CompareChains chart data', () => {
	test('keeps selected and chain order while aligning sparse second and millisecond timestamps', () => {
		const result = buildCompareChainsChartData(
			[
				{
					chain: 'Ethereum',
					tvlChart: [
						[2000, 20],
						[1000, 10]
					],
					dexVolumeChart: [[1, 100]],
					chainFeesChart: null,
					chainRevenueChart: null
				},
				{
					chain: 'Solana',
					tvlChart: [[2000, 40]],
					dexVolumeChart: [[2, 200]],
					chainFeesChart: null,
					chainRevenueChart: null
				}
			],
			['dexVolumeChart', 'tvlChart']
		)

		expect(result.dataset.dimensions).toEqual([
			'timestamp',
			'Ethereum - DEXs Volume',
			'Solana - DEXs Volume',
			'Ethereum - TVL',
			'Solana - TVL'
		])
		expect(result.dataset.source).toEqual([
			[1000, 100, null, 10, null],
			[2000, null, 200, 20, 40]
		])
		expect(result.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Ethereum - DEXs Volume', type: 'bar' },
			{ name: 'Solana - DEXs Volume', type: 'bar' },
			{ name: 'Ethereum - TVL', type: 'line' },
			{ name: 'Solana - TVL', type: 'line' }
		])
		expect(result.showTotalInTooltip).toBe(false)
	})

	test('shows a tooltip total only when every displayed series has the same metric meaning', () => {
		const chainData: Parameters<typeof buildCompareChainsChartData>[0] = [
			{
				chain: 'Ethereum',
				tvlChart: [[1000, 10]],
				dexVolumeChart: [[1, 100]],
				chainFeesChart: null,
				chainRevenueChart: null
			},
			{
				chain: 'Solana',
				tvlChart: [[1000, 20]],
				dexVolumeChart: [[1, 200]],
				chainFeesChart: null,
				chainRevenueChart: null
			}
		]

		expect(buildCompareChainsChartData(chainData, ['tvlChart']).showTotalInTooltip).toBe(true)
		expect(buildCompareChainsChartData(chainData, ['tvlChart', 'dexVolumeChart']).showTotalInTooltip).toBe(false)
	})

	test('returns an empty time-series contract for no chains', () => {
		expect(buildCompareChainsChartData([], ['tvlChart'])).toEqual({
			dataset: { source: [], dimensions: ['timestamp'] },
			charts: [],
			showTotalInTooltip: false
		})
	})
})

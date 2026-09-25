import { describe, expect, test } from 'vitest'
import { buildCompareProtocolsChartData } from '../chartData'

const FIRST_DAY = 1_728_000_000_000
const SECOND_DAY = FIRST_DAY + 86_400_000

describe('buildCompareProtocolsChartData', () => {
	test('keeps independently timed V2 TVL series in chronological sparse comparison rows', () => {
		const result = buildCompareProtocolsChartData({
			protocolCharts: [
				{
					name: 'Aave',
					tvlChart: [
						[FIRST_DAY, 100],
						[SECOND_DAY, 120]
					],
					extraTvlCharts: {}
				},
				{
					name: 'Compound',
					tvlChart: [[SECOND_DAY, 50]],
					extraTvlCharts: {}
				}
			],
			extraTvlEnabled: { borrowed: false }
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Aave', 'Compound'],
			source: [
				[FIRST_DAY, 100, null],
				[SECOND_DAY, 120, 50]
			]
		})
		expect(result.charts.map((chart) => chart.name)).toEqual(['Aave', 'Compound'])
		expect(result.charts.every((chart) => chart.type === 'line')).toBe(true)
	})

	test('keeps failed enabled sections as gaps while a successful empty section contributes zero', () => {
		const failed = buildCompareProtocolsChartData({
			protocolCharts: [
				{
					name: 'Aave',
					tvlChart: [[FIRST_DAY, 100]],
					extraTvlCharts: { borrowed: null }
				}
			],
			extraTvlEnabled: { borrowed: true }
		})
		const successfulEmpty = buildCompareProtocolsChartData({
			protocolCharts: [
				{
					name: 'Aave',
					tvlChart: [[FIRST_DAY, 100]],
					extraTvlCharts: { borrowed: [] }
				}
			],
			extraTvlEnabled: { borrowed: true }
		})

		expect(failed.dataset.source).toEqual([[FIRST_DAY, null]])
		expect(successfulEmpty.dataset.source).toEqual([[FIRST_DAY, 100]])
	})

	test('retains selected series identity and order when a base source is unavailable', () => {
		const result = buildCompareProtocolsChartData({
			protocolCharts: [
				{ name: 'Unavailable', tvlChart: null, extraTvlCharts: {} },
				{ name: 'Available', tvlChart: [[FIRST_DAY, 10]], extraTvlCharts: {} }
			],
			extraTvlEnabled: {}
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Unavailable', 'Available'],
			source: [[FIRST_DAY, null, 10]]
		})
		expect(result.charts.map((chart) => chart.name)).toEqual(['Unavailable', 'Available'])
	})

	test('uses additive history when the base chart succeeds empty, but not when the base request fails', () => {
		const successfulEmpty = buildCompareProtocolsChartData({
			protocolCharts: [
				{ name: 'Additive Only', tvlChart: [], extraTvlCharts: { borrowed: [[FIRST_DAY, 7]] } },
				{ name: 'Available', tvlChart: [[FIRST_DAY, 10]], extraTvlCharts: { borrowed: [] } }
			],
			extraTvlEnabled: { borrowed: true }
		})
		const failed = buildCompareProtocolsChartData({
			protocolCharts: [
				{ name: 'Failed', tvlChart: null, extraTvlCharts: { borrowed: [[FIRST_DAY, 7]] } },
				{ name: 'Available', tvlChart: [[FIRST_DAY, 10]], extraTvlCharts: { borrowed: [] } }
			],
			extraTvlEnabled: { borrowed: true }
		})

		expect(successfulEmpty.dataset.source).toEqual([[FIRST_DAY, 7, 10]])
		expect(failed.dataset.source).toEqual([[FIRST_DAY, null, 10]])
	})

	test('composes enabled local TVL settings from focused V2 charts', () => {
		const result = buildCompareProtocolsChartData({
			protocolCharts: [
				{
					name: 'Aave',
					tvlChart: [[FIRST_DAY, 100]],
					extraTvlCharts: { borrowed: [[FIRST_DAY, 25]] }
				}
			],
			extraTvlEnabled: { borrowed: true }
		})

		expect(result.dataset.source).toEqual([[FIRST_DAY, 125]])
	})
})

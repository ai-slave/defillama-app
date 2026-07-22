import { describe, expect, it } from 'vitest'
import { buildCompareProtocolsChartData } from '../chartData'

const FIRST_DAY = 1_728_000_000_000
const SECOND_DAY = FIRST_DAY + 86_400_000

describe('buildCompareProtocolsChartData', () => {
	it('keeps independently timed V2 TVL series in chronological sparse comparison rows', () => {
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
				[FIRST_DAY, 100, undefined],
				[SECOND_DAY, 120, 50]
			]
		})
		expect(result.charts.map((chart) => chart.name)).toEqual(['Aave', 'Compound'])
		expect(result.charts.every((chart) => chart.type === 'line')).toBe(true)
	})

	it('composes enabled local TVL settings from focused V2 charts', () => {
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

	it('keeps a protocol with no focused chart rows as an empty series', () => {
		const result = buildCompareProtocolsChartData({
			protocolCharts: [
				{
					name: 'Aave',
					tvlChart: null,
					extraTvlCharts: {}
				}
			],
			extraTvlEnabled: {}
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Aave'],
			source: []
		})
	})
})

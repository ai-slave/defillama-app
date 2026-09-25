import { describe, expect, test } from 'vitest'
import { createOverviewTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/overviewTooltip'
import { buildChainChartPresentation } from '../chartPresentation'
import { buildChainYAxis } from '../chartYAxis'
import { chainOverviewChartColors } from '../constants'

const seriesSummary = (presentation: ReturnType<typeof buildChainChartPresentation>) =>
	presentation.charts.map((chart) => [chart.name, chart.type, chart.yAxisIndex])

describe('chain chart presentation', () => {
	test('keeps sparse per-metric data and gives each metric its own type and axis', () => {
		const presentation = buildChainChartPresentation(
			{
				TVL: [
					[1000, 10],
					[3000, 12]
				],
				'Chain Fees': [
					[1000, 2],
					[2000, 3]
				],
				'Chain Revenue': [[1000, 1]],
				'Active Addresses': [[2000, 100]]
			},
			'daily'
		)

		expect(seriesSummary(presentation)).toEqual([
			['TVL', 'line', 0],
			['Chain Fees', 'bar', 1],
			['Chain Revenue', 'bar', 1],
			['Active Addresses', 'bar', 2]
		])
		expect(presentation.charts[0]?.data).toEqual([
			[1000, 10],
			[3000, 12]
		])
		expect(presentation.charts[1]?.data).toEqual([
			[1000, 2],
			[2000, 3]
		])
	})

	test('draws cumulative flows as lines while snapshot counts stay bars', () => {
		const presentation = buildChainChartPresentation(
			{ TVL: [[1000, 10]], 'Chain Fees': [[1000, 2]], 'Core Developers': [[2000, 7]] },
			'cumulative'
		)

		expect(seriesSummary(presentation)).toEqual([
			['TVL', 'line', 0],
			['Chain Fees', 'line', 1],
			['Core Developers', 'bar', 2]
		])
	})

	test('keeps converted and intrinsically USD series units distinct on axes and tooltips', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		const usdSeries = ['Token Price', 'Token Mcap', 'Token Volume', 'Raises']
		const presentation = buildChainChartPresentation(
			{
				TVL: [[timestamp, 1]],
				'Token Price': [[timestamp, 2000]],
				'Token Mcap': [[timestamp, 3000]],
				'Token Volume': [[timestamp, 4000]],
				Raises: [[timestamp, 5000]]
			},
			'daily'
		)
		const axes = buildChainYAxis({
			allYAxis: presentation.allYAxis,
			baseYAxis: {},
			chartColors: chainOverviewChartColors,
			chartsInSeries: presentation.chartsInSeries,
			themeText: '#000'
		})
		const tokenPriceAxis = axes[presentation.charts.find((chart) => chart.name === 'Token Price')!.yAxisIndex!]
		const formatter = tokenPriceAxis?.axisLabel?.formatter
		if (typeof formatter !== 'function') throw new Error('Expected a Token Price axis formatter')
		expect(formatter(5, 0, null)).toBe('$5')

		const tooltip = createOverviewTooltipFormatter({
			valueSymbol: 'ETH',
			unlockTokenSymbol: '',
			seriesValueSymbols: presentation.seriesValueSymbols
		})(
			['TVL', ...usdSeries].map((seriesName, index) => ({
				axisValue: timestamp,
				seriesName,
				value: [timestamp, index + 1],
				encode: { y: [1] }
			}))
		)
		expect(tooltip).toContain('TVL&nbsp;&nbsp;1 ETH')
		for (const seriesName of usdSeries) {
			expect(tooltip).toContain(`${seriesName}&nbsp;&nbsp;$`)
		}
	})

	test('labels grouped active addresses as a daily average', () => {
		const presentation = buildChainChartPresentation({ 'Active Addresses': [[1000, 5]] }, 'weekly')

		expect(presentation.charts.map((chart) => chart.name)).toEqual(['Active Addresses (daily average)'])
	})
})

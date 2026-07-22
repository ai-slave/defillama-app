import { describe, expect, it } from 'vitest'
import { buildMultiChartCsvRows, buildMultiChartSeriesView, type MultiChartInputSeries } from './multiChartSeries'

const FLOW: MultiChartInputSeries = {
	name: 'Fees',
	baseType: 'bar',
	data: [
		[1, 10],
		[3, -3]
	],
	color: '#111111',
	metricType: 'fees'
}

const SNAPSHOT: MultiChartInputSeries = {
	name: 'TVL',
	baseType: 'area',
	data: [
		[1, 100],
		[2, 90]
	],
	color: '#222222',
	metricType: 'tvl'
}

describe('buildMultiChartSeriesView', () => {
	it('turns only cumulative flow bars into running-total lines', () => {
		const result = buildMultiChartSeriesView({
			series: [FLOW, SNAPSHOT],
			showCumulative: true,
			showPercentage: false,
			stackSeries: false
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Fees', 'TVL'],
			source: [
				[1_000, 10, 100],
				[2_000, 10, 90],
				[3_000, 7, null]
			]
		})
		expect(result.charts).toEqual([
			expect.objectContaining({ name: 'Fees', type: 'line', connectNulls: true }),
			expect.objectContaining({ name: 'TVL', type: 'line', connectNulls: true })
		])
	})

	it('carries independently timed cumulative flows into percentage rows', () => {
		const result = buildMultiChartSeriesView({
			series: [
				{ ...FLOW, name: 'A', data: [[1, 100]] },
				{ ...FLOW, name: 'B', data: [[2, 100]] }
			],
			showCumulative: true,
			showPercentage: true,
			stackSeries: false
		})

		expect(result.dataset.source).toEqual([
			[1_000, 100, 0],
			[2_000, 50, 50]
		])
	})

	it('zero-fills and stacks aligned bar series without re-sorting input', () => {
		const result = buildMultiChartSeriesView({
			series: [FLOW, { ...FLOW, name: 'Revenue', data: [[2, 4]], color: '#333333' }],
			showCumulative: false,
			showPercentage: false,
			stackSeries: true
		})

		expect(result.dataset.source).toEqual([
			[1_000, 10, 0],
			[2_000, 0, 4],
			[3_000, -3, 0]
		])
		expect(result.charts.every((chart) => chart.type === 'bar' && chart.stack === 'total')).toBe(true)
		expect(result.charts.every((chart) => !('connectNulls' in chart))).toBe(true)
	})

	it('uses the existing solid area presentation for stacked snapshot series', () => {
		const result = buildMultiChartSeriesView({
			series: [SNAPSHOT, { ...SNAPSHOT, name: 'Stablecoins', color: '#333333' }],
			showCumulative: false,
			showPercentage: false,
			stackSeries: true
		})

		expect(result.charts.every((chart) => chart.type === 'line' && chart.stack === 'total')).toBe(true)
		expect(result.solidChartAreaStyle).toBe(true)
	})

	it('calculates percentages row-major and orders the stack by average share', () => {
		const result = buildMultiChartSeriesView({
			series: [
				{ ...FLOW, name: 'Large', data: [[1, 75]] },
				{ ...FLOW, name: 'Small', data: [[1, 25]] }
			],
			showCumulative: false,
			showPercentage: true,
			stackSeries: false
		})

		expect(result.dataset.source).toEqual([[1_000, 75, 25]])
		expect(result.charts.map((chart) => chart.name)).toEqual(['Small', 'Large'])
		expect(result.charts.every((chart) => chart.valueSymbol === '%' && chart.yAxisIndex === 0)).toBe(true)
		expect(result.solidChartAreaStyle).toBe(true)
	})

	it('preserves mixed-unit y-axis assignments and symbols', () => {
		const result = buildMultiChartSeriesView({
			series: [FLOW, { ...SNAPSHOT, name: 'APY', metricType: 'medianApy' }],
			showCumulative: false,
			showPercentage: false,
			stackSeries: false
		})

		expect(result.charts).toEqual([
			expect.objectContaining({ name: 'Fees', yAxisIndex: 0, valueSymbol: '$' }),
			expect.objectContaining({ name: 'APY', yAxisIndex: 1, valueSymbol: '%' })
		])
	})

	it('exports the row-major dataset in displayed chart order', () => {
		const result = buildMultiChartSeriesView({
			series: [
				{ ...FLOW, name: 'Large', data: [[1, 75]] },
				{ ...FLOW, name: 'Small', data: [[1, 25]] }
			],
			showCumulative: false,
			showPercentage: true,
			stackSeries: false
		})

		expect(buildMultiChartCsvRows(result)).toEqual([
			['Date', 'Small', 'Large'],
			['1970-01-01', '25', '75']
		])
	})

	it('exports missing snapshot observations as empty fields while preserving real flow zeroes', () => {
		const result = buildMultiChartSeriesView({
			series: [
				{ ...SNAPSHOT, data: [[1, 100]] },
				{ ...FLOW, data: [[2, 0]] }
			],
			showCumulative: false,
			showPercentage: false,
			stackSeries: false
		})

		expect(buildMultiChartCsvRows(result)).toEqual([
			['Date', 'TVL', 'Fees'],
			['1970-01-01', '100', ''],
			['1970-01-01', '', '0']
		])
	})

	it('returns an empty canonical dataset when no source has data', () => {
		expect(
			buildMultiChartSeriesView({
				series: [],
				showCumulative: false,
				showPercentage: false,
				stackSeries: false
			})
		).toEqual({
			dataset: { source: [], dimensions: ['timestamp'] },
			charts: [],
			solidChartAreaStyle: false
		})
	})
})

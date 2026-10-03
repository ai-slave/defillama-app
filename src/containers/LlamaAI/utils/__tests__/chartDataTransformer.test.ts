import { describe, expect, test } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import type { AdaptedLlamaAICartesianChart } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import type { ChartCapabilities, ChartViewState } from '~/containers/LlamaAI/utils/chartCapabilities'
import { ChartDataTransformer } from '../chartDataTransformer'
import { buildExportModel } from '../chartExportModel'

const capabilities: ChartCapabilities = {
	allowStack: true,
	allowPercentage: true,
	allowCumulative: false,
	allowGrouping: false,
	groupingLocked: false,
	allowHallmarks: false,
	allowLabels: false,
	allowLogScale: false,
	logEligibleYAxes: [],
	groupingOptions: []
}

const viewState: ChartViewState = {
	stacked: false,
	percentage: true,
	cumulative: false,
	grouping: 'day',
	showHallmarks: false,
	showLabels: false,
	logScale: false
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object') {
		for (const nestedValue of Object.values(value)) deepFreeze(nestedValue)
		Object.freeze(value)
	}
	return value
}

function makeMixedAxisChart(axisType: 'time' | 'category'): AdaptedLlamaAICartesianChart {
	const dimensionName = axisType === 'time' ? 'timestamp' : 'category'
	const xValue = axisType === 'time' ? Date.UTC(2026, 0, 1) : 'Protocols'

	return {
		chartType: 'cartesian',
		props: {
			dataset: {
				dimensions: [dimensionName, 'Primary A', 'Primary B', 'Secondary'],
				source: [[xValue, 20, 30, 5]]
			},
			charts: [
				{
					type: 'line',
					name: 'Primary A',
					encode: { x: 0, y: 1 },
					color: '#111',
					valueSymbol: '$',
					yAxisIndex: 0
				},
				{
					type: 'line',
					name: 'Primary B',
					encode: { x: 0, y: 2 },
					color: '#222',
					valueSymbol: '$',
					yAxisIndex: 0
				},
				{
					type: 'line',
					name: 'Secondary',
					encode: { x: 0, y: 3 },
					color: '#333',
					valueSymbol: '$',
					yAxisIndex: 1
				}
			],
			chartOptions: {},
			valueSymbol: '$'
		},
		title: 'Mixed axes',
		description: '',
		rowCount: 1,
		axisType,
		isTimeChart: axisType === 'time',
		hasHallmarks: false,
		groupingPolicy: axisType === 'time' ? 'always' : 'never',
		defaultExportKind: 'cartesian',
		seriesMeta: [
			{
				name: 'Primary A',
				seriesIndex: 0,
				metricClass: 'stock',
				baseType: 'line',
				resolvedColor: '#111',
				valueSymbol: '$',
				yAxisIndex: 0,
				isPrimaryAxis: true,
				canStack: true,
				canPercentage: true,
				canGroup: axisType === 'time'
			},
			{
				name: 'Primary B',
				seriesIndex: 1,
				metricClass: 'stock',
				baseType: 'line',
				resolvedColor: '#222',
				valueSymbol: '$',
				yAxisIndex: 0,
				isPrimaryAxis: true,
				canStack: true,
				canPercentage: true,
				canGroup: axisType === 'time'
			},
			{
				name: 'Secondary',
				seriesIndex: 2,
				metricClass: 'stock',
				baseType: 'line',
				resolvedColor: '#333',
				valueSymbol: '$',
				yAxisIndex: 1,
				isPrimaryAxis: false,
				canStack: false,
				canPercentage: false,
				canGroup: axisType === 'time'
			}
		]
	}
}

function makeAscendingBarChart(): AdaptedLlamaAICartesianChart {
	const mar = Date.UTC(2026, 2, 1)
	const jan = Date.UTC(2026, 0, 1)
	const feb = Date.UTC(2026, 1, 1)

	return {
		chartType: 'cartesian',
		props: {
			dataset: {
				dimensions: ['timestamp', 'Revenue'],
				source: [
					[jan, 10],
					[feb, 20],
					[mar, 30]
				]
			},
			charts: [
				{
					type: 'bar',
					name: 'Revenue',
					encode: { x: 0, y: 1 },
					color: '#111',
					valueSymbol: '$',
					yAxisIndex: 0
				}
			],
			chartOptions: {},
			valueSymbol: '$'
		},
		title: 'Revenue',
		description: '',
		rowCount: 3,
		axisType: 'time',
		isTimeChart: true,
		hasHallmarks: false,
		groupingPolicy: 'always',
		defaultExportKind: 'cartesian',
		seriesMeta: [
			{
				name: 'Revenue',
				seriesIndex: 0,
				metricClass: 'flow',
				baseType: 'bar',
				resolvedColor: '#111',
				valueSymbol: '$',
				yAxisIndex: 0,
				isPrimaryAxis: true,
				canStack: true,
				canPercentage: true,
				canGroup: true
			}
		]
	}
}

function makeLegacyTimestampChart(): AdaptedLlamaAICartesianChart {
	const chart = makeAscendingBarChart()
	chart.props.dataset.source = [
		[String(Date.UTC(2026, 0, 1) / 1e3), 10],
		['not-a-date', 999],
		['', 999],
		[null, 999],
		['2026-02-01T00:00:00.000Z', 20],
		[String(Date.UTC(2026, 2, 1)), 30],
		[Date.UTC(2026, 3, 1), 40]
	]
	chart.rowCount = chart.props.dataset.source.length
	return chart
}

describe('ChartDataTransformer', () => {
	test('with percentage and stacking off, the chart shows its raw values', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeAscendingBarChart(),
			{ ...viewState, percentage: false },
			capabilities
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 1, 1), 20],
			[Date.UTC(2026, 2, 1), 30]
		])
		expect(transformed.props.charts?.map((series) => series.stack)).toEqual([undefined])
	})

	test('stacking stacks the primary-axis series only and leaves the values alone', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeMixedAxisChart('time'),
			{ ...viewState, percentage: false, stacked: true },
			{ ...capabilities, allowStack: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.charts?.map((series) => series.stack)).toEqual(['total', 'total', undefined])
		expect(transformed.props.dataset.source).toEqual([[Date.UTC(2026, 0, 1), 20, 30, 5]])
	})

	test('keeps the configured series order when stacking instead of re-sorting by magnitude', () => {
		const chart = makeMixedAxisChart('time')
		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, percentage: false, stacked: true },
			{ ...capabilities, allowStack: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.charts?.map((series) => series.name)).toEqual(['Primary A', 'Primary B', 'Secondary'])
		expect(transformed.seriesMeta.map((series) => series.name)).toEqual(['Primary A', 'Primary B', 'Secondary'])
	})

	test('keeps the configured series order for the stacked percentage view', () => {
		const chart = makeMixedAxisChart('time')
		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, percentage: true, stacked: true },
			{ ...capabilities, allowStack: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.charts?.map((series) => series.name)).toEqual(['Primary A', 'Primary B', 'Secondary'])
		expect(transformed.seriesMeta.map((series) => series.name)).toEqual(['Primary A', 'Primary B', 'Secondary'])
	})

	test('delegates time tooltip formatting while preserving per-series symbols', () => {
		const transformed = ChartDataTransformer.applyViewState(makeMixedAxisChart('time'), viewState, capabilities)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		const tooltipOption = Array.isArray(transformed.props.chartOptions?.tooltip)
			? transformed.props.chartOptions.tooltip[0]
			: transformed.props.chartOptions?.tooltip
		expect(tooltipOption?.formatter).toBeUndefined()
		expect(transformed.props.charts?.map((series) => [series.name, series.valueSymbol])).toEqual([
			['Primary A', '%'],
			['Primary B', '%'],
			['Secondary', '$']
		])
	})

	test('keeps secondary-axis symbols in percentage tooltips for category charts', () => {
		const transformed = ChartDataTransformer.applyViewState(makeMixedAxisChart('category'), viewState, capabilities)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		const tooltipOption = Array.isArray(transformed.props.chartOptions?.tooltip)
			? transformed.props.chartOptions.tooltip[0]
			: transformed.props.chartOptions?.tooltip
		const formatter = tooltipOption?.formatter
		if (typeof formatter !== 'function') throw new Error('Expected tooltip formatter')

		const row = transformed.props.dataset.source[0]
		// ECharts passes each series its dataset row and the encoded y column.
		const tooltip = formatter(
			(transformed.props.charts ?? []).map((series) => ({
				seriesName: series.name,
				data: row,
				marker: '',
				encode: { x: [0], y: [series.encode.y] }
			})) as Parameters<typeof formatter>[0],
			''
		)

		expect(tooltip).toContain('Primary A: 40%')
		expect(tooltip).toContain('Primary B: 60%')
		expect(tooltip).toContain('Secondary: $5')
	})

	test('preserves chronological order while grouping an ascending dataset', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeAscendingBarChart(),
			{ ...viewState, grouping: 'month', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source.map((row) => row[0])).toEqual([
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 1, 1),
			Date.UTC(2026, 2, 1)
		])
	})

	test('exports grouped rows with the bounds of the period each one sums', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeAscendingBarChart(),
			{ ...viewState, grouping: 'month', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		// Only the title is read for time-series exports.
		const csvRows = buildExportModel({ title: 'Fees' } as ChartConfiguration, transformed)?.csvRows

		expect(csvRows?.[0]?.slice(0, 3)).toEqual(['Timestamp', 'Month start', 'Month end'])
		expect(csvRows?.[2]?.slice(0, 3)).toEqual([Date.UTC(2026, 1, 1), '2026-02-01', '2026-02-28'])
	})

	test('preserves chronological order while accumulating an ascending dataset', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeAscendingBarChart(),
			{ ...viewState, cumulative: true, percentage: false },
			{ ...capabilities, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source.map((row) => row[0])).toEqual([
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 1, 1),
			Date.UTC(2026, 2, 1)
		])
	})

	test('sums flow buckets and keeps the latest stock snapshot in one pass', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.dimensions.push('TVL')
		chart.props.dataset.source = [
			[Date.UTC(2026, 0, 2), 10, 100],
			[Date.UTC(2026, 0, 3), 20, 120],
			[Date.UTC(2026, 1, 1), 30, 110]
		]
		chart.props.charts?.push({
			type: 'line',
			name: 'TVL',
			encode: { x: 0, y: 2 },
			color: '#222',
			valueSymbol: '$',
			yAxisIndex: 0
		})
		chart.seriesMeta.push({
			name: 'TVL',
			seriesIndex: 1,
			metricClass: 'stock',
			baseType: 'line',
			resolvedColor: '#222',
			valueSymbol: '$',
			yAxisIndex: 0,
			isPrimaryAxis: true,
			canStack: true,
			canPercentage: true,
			canGroup: true
		})

		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, grouping: 'month', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 30, 120],
			[Date.UTC(2026, 1, 1), 30, 110]
		])
	})

	test('accumulates flow bars without changing stock bars', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.dimensions.push('TVL')
		chart.props.dataset.source = [
			[Date.UTC(2026, 0, 1), 10, 100],
			[Date.UTC(2026, 1, 1), undefined, 90],
			[Date.UTC(2026, 2, 1), 30, 110]
		]
		chart.props.charts?.push({
			type: 'bar',
			name: 'TVL',
			encode: { x: 0, y: 2 },
			color: '#222',
			valueSymbol: '$',
			yAxisIndex: 1
		})
		chart.seriesMeta.push({
			name: 'TVL',
			seriesIndex: 1,
			metricClass: 'stock',
			baseType: 'bar',
			resolvedColor: '#222',
			valueSymbol: '$',
			yAxisIndex: 1,
			isPrimaryAxis: false,
			canStack: false,
			canPercentage: false,
			canGroup: true
		})

		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, cumulative: true, percentage: false },
			{ ...capabilities, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 10, 100],
			[Date.UTC(2026, 1, 1), 10, 90],
			[Date.UTC(2026, 2, 1), 40, 110]
		])
		expect(transformed.props.charts).toMatchObject([
			{ name: 'Revenue', type: 'line', hideAreaStyle: true },
			{ name: 'TVL', type: 'bar' }
		])
	})

	test('keeps a line-only cumulative view identical to daily values', () => {
		const chart = makeMixedAxisChart('time')
		chart.props.dataset.source = [
			[Date.UTC(2026, 0, 1), 20, 30, 5],
			[Date.UTC(2026, 0, 2), 25, 28, 6]
		]

		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, cumulative: true, percentage: false },
			{ ...capabilities, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual(chart.props.dataset.source)
		expect(transformed.props.charts).toEqual(chart.props.charts)
	})

	test('groups then accumulates flow buckets without mutating a deeply frozen adapted chart', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.source.push([Date.UTC(2026, 3, 1), 40])
		chart.rowCount = chart.props.dataset.source.length
		deepFreeze(chart)

		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, grouping: 'quarter', cumulative: true, percentage: false, stacked: false },
			{ ...capabilities, allowGrouping: true, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed).not.toBe(chart)
		expect(transformed.props.dataset).not.toBe(chart.props.dataset)
		expect(transformed.props.dataset.source).not.toBe(chart.props.dataset.source)
		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 60],
			[Date.UTC(2026, 3, 1), 100]
		])
		expect(chart.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 1, 1), 20],
			[Date.UTC(2026, 2, 1), 30],
			[Date.UTC(2026, 3, 1), 40]
		])
	})

	test('normalizes negative, missing, and zero percentage buckets without mutating input', () => {
		const chart = makeMixedAxisChart('time')
		chart.props.dataset.source = [
			[Date.UTC(2026, 0, 1), -20, 30, 5],
			[Date.UTC(2026, 0, 2), undefined, 10, 6],
			[Date.UTC(2026, 0, 3), 0, 0, 7]
		]
		chart.rowCount = chart.props.dataset.source.length
		deepFreeze(chart)

		const transformed = ChartDataTransformer.applyViewState(chart, { ...viewState, stacked: true }, capabilities)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), -40, 60, 5],
			[Date.UTC(2026, 0, 2), 0, 100, 6],
			[Date.UTC(2026, 0, 3), 0, 0, 7]
		])
		expect(transformed.props.charts?.filter((series) => (series.yAxisIndex ?? 0) === 0)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Primary A', hideAreaStyle: true, valueSymbol: '%' }),
				expect.objectContaining({ name: 'Primary B', hideAreaStyle: true, valueSymbol: '%' })
			])
		)
		expect(transformed.props.charts?.find((series) => series.name === 'Primary A')).not.toHaveProperty('stack')
		expect(transformed.props.charts?.find((series) => series.name === 'Primary B')).not.toHaveProperty('stack')
		expect(transformed.props.charts?.find((series) => series.name === 'Secondary')).toMatchObject({
			valueSymbol: '$',
			yAxisIndex: 1
		})
		expect(chart.props.dataset.source[1][1]).toBeUndefined()
		expect(chart.props.dataset.source[0]?.[1]).toBe(-20)
	})

	test('groups legacy string timestamps and skips malformed timestamps', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeLegacyTimestampChart(),
			{ ...viewState, grouping: 'month', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 1, 1), 20],
			[Date.UTC(2026, 2, 1), 30],
			[Date.UTC(2026, 3, 1), 40]
		])
	})

	test('applies cumulative view to legacy string timestamps and skips malformed timestamps', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeLegacyTimestampChart(),
			{ ...viewState, cumulative: true, percentage: false },
			{ ...capabilities, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			[Date.UTC(2026, 0, 1), 10],
			[Date.UTC(2026, 1, 1), 30],
			[Date.UTC(2026, 2, 1), 60],
			[Date.UTC(2026, 3, 1), 100]
		])
	})
})

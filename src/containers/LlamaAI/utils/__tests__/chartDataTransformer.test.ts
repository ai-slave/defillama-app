import { describe, expect, it } from 'vitest'
import type { AdaptedLlamaAICartesianChart } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import type { ChartCapabilities, ChartViewState } from '~/containers/LlamaAI/utils/chartCapabilities'
import { ChartDataTransformer } from '../chartDataTransformer'

const capabilities: ChartCapabilities = {
	allowStack: true,
	allowPercentage: true,
	allowCumulative: false,
	allowGrouping: false,
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
				source: [{ [dimensionName]: xValue, 'Primary A': 20, 'Primary B': 30, Secondary: 5 }]
			},
			charts: [
				{
					type: 'line',
					name: 'Primary A',
					encode: { x: dimensionName, y: 'Primary A' },
					color: '#111',
					valueSymbol: '$',
					yAxisIndex: 0
				},
				{
					type: 'line',
					name: 'Primary B',
					encode: { x: dimensionName, y: 'Primary B' },
					color: '#222',
					valueSymbol: '$',
					yAxisIndex: 0
				},
				{
					type: 'line',
					name: 'Secondary',
					encode: { x: dimensionName, y: 'Secondary' },
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
					{ timestamp: jan, Revenue: 10 },
					{ timestamp: feb, Revenue: 20 },
					{ timestamp: mar, Revenue: 30 }
				]
			},
			charts: [
				{
					type: 'bar',
					name: 'Revenue',
					encode: { x: 'timestamp', y: 'Revenue' },
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
		{ timestamp: String(Date.UTC(2026, 0, 1) / 1e3), Revenue: 10 },
		{ timestamp: 'not-a-date', Revenue: 999 },
		{ timestamp: '', Revenue: 999 },
		{ timestamp: null, Revenue: 999 },
		{ timestamp: '2026-02-01T00:00:00.000Z', Revenue: 20 },
		{ timestamp: String(Date.UTC(2026, 2, 1)), Revenue: 30 },
		{ timestamp: Date.UTC(2026, 3, 1), Revenue: 40 }
	]
	chart.rowCount = chart.props.dataset.source.length
	return chart
}

describe('ChartDataTransformer', () => {
	it('reuses canonical data when no view transform is active', () => {
		const chart = makeAscendingBarChart()
		const transformed = ChartDataTransformer.applyViewState(chart, { ...viewState, percentage: false }, capabilities)

		expect(transformed).toBe(chart)
		expect(transformed.props.dataset.source).toBe(chart.props.dataset.source)
	})

	it('reuses canonical rows when stacking changes only series presentation', () => {
		const chart = makeMixedAxisChart('time')
		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, percentage: false, stacked: true },
			{ ...capabilities, allowStack: true }
		)

		expect(transformed).not.toBe(chart)
		expect(transformed.props.dataset.source).toBe(chart.props.dataset.source)
		expect(transformed.props.charts).not.toBe(chart.props.charts)
	})

	it('delegates time tooltip formatting while preserving per-series symbols', () => {
		const transformed = ChartDataTransformer.applyViewState(makeMixedAxisChart('time'), viewState, capabilities)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.chartOptions?.tooltip?.formatter).toBeUndefined()
		expect(transformed.props.charts?.map((series) => [series.name, series.valueSymbol])).toEqual([
			['Primary A', '%'],
			['Primary B', '%'],
			['Secondary', '$']
		])
	})

	it('keeps secondary-axis symbols in percentage tooltips for category charts', () => {
		const transformed = ChartDataTransformer.applyViewState(makeMixedAxisChart('category'), viewState, capabilities)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		const formatter = transformed.props.chartOptions?.tooltip?.formatter
		if (typeof formatter !== 'function') throw new Error('Expected tooltip formatter')

		const row = transformed.props.dataset.source[0]
		const tooltip = formatter([
			{ seriesName: 'Primary A', data: row, marker: '' },
			{ seriesName: 'Primary B', data: row, marker: '' },
			{ seriesName: 'Secondary', data: row, marker: '' }
		])

		expect(tooltip).toContain('Primary A: 40%')
		expect(tooltip).toContain('Primary B: 60%')
		expect(tooltip).toContain('Secondary: $5')
	})

	it('preserves chronological order while grouping an ascending dataset', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeAscendingBarChart(),
			{ ...viewState, grouping: 'month', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source.map((row) => row.timestamp)).toEqual([
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 1, 1),
			Date.UTC(2026, 2, 1)
		])
	})

	it('preserves chronological order while accumulating an ascending dataset', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeAscendingBarChart(),
			{ ...viewState, cumulative: true, percentage: false },
			{ ...capabilities, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source.map((row) => row.timestamp)).toEqual([
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 1, 1),
			Date.UTC(2026, 2, 1)
		])
	})

	it('sums flow buckets and keeps the latest stock snapshot in one pass', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.dimensions.push('TVL')
		chart.props.dataset.source = [
			{ timestamp: Date.UTC(2026, 0, 2), Revenue: 10, TVL: 100 },
			{ timestamp: Date.UTC(2026, 0, 3), Revenue: 20, TVL: 120 },
			{ timestamp: Date.UTC(2026, 1, 1), Revenue: 30, TVL: 110 }
		]
		chart.props.charts?.push({
			type: 'line',
			name: 'TVL',
			encode: { x: 'timestamp', y: 'TVL' },
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
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 30, TVL: 120 },
			{ timestamp: Date.UTC(2026, 1, 1), Revenue: 30, TVL: 110 }
		])
	})

	it('accumulates flow bars without changing stock bars', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.dimensions.push('TVL')
		chart.props.dataset.source = [
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 10, TVL: 100 },
			{ timestamp: Date.UTC(2026, 1, 1), TVL: 90 },
			{ timestamp: Date.UTC(2026, 2, 1), Revenue: 30, TVL: 110 }
		]
		chart.props.charts?.push({
			type: 'bar',
			name: 'TVL',
			encode: { x: 'timestamp', y: 'TVL' },
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
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 10, TVL: 100 },
			{ timestamp: Date.UTC(2026, 1, 1), Revenue: 10, TVL: 90 },
			{ timestamp: Date.UTC(2026, 2, 1), Revenue: 40, TVL: 110 }
		])
		expect(transformed.props.charts).toMatchObject([
			{ name: 'Revenue', type: 'line', hideAreaStyle: true },
			{ name: 'TVL', type: 'bar' }
		])
	})

	it('keeps a line-only cumulative view identical to daily values', () => {
		const chart = makeMixedAxisChart('time')
		chart.props.dataset.source = [
			{ timestamp: Date.UTC(2026, 0, 1), 'Primary A': 20, 'Primary B': 30, Secondary: 5 },
			{ timestamp: Date.UTC(2026, 0, 2), 'Primary A': 25, 'Primary B': 28, Secondary: 6 }
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

	it('groups then accumulates flow buckets without mutating a deeply frozen adapted chart', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.source.push({ timestamp: Date.UTC(2026, 3, 1), Revenue: 40 })
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
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 60 },
			{ timestamp: Date.UTC(2026, 3, 1), Revenue: 100 }
		])
		expect(chart.props.dataset.source).toEqual([
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 10 },
			{ timestamp: Date.UTC(2026, 1, 1), Revenue: 20 },
			{ timestamp: Date.UTC(2026, 2, 1), Revenue: 30 },
			{ timestamp: Date.UTC(2026, 3, 1), Revenue: 40 }
		])
	})

	it('keeps prototype-like series names on ordinary ECharts rows after grouping', () => {
		const chart = makeAscendingBarChart()
		chart.props.dataset.dimensions = ['timestamp', '__proto__']
		chart.props.dataset.source = chart.props.dataset.source.map((row) => {
			const nextRow: Record<string, number> = { timestamp: row.timestamp as number }
			Object.defineProperty(nextRow, '__proto__', {
				value: row.Revenue,
				enumerable: true,
				configurable: true,
				writable: true
			})
			return nextRow
		})
		chart.props.charts![0] = {
			...chart.props.charts![0],
			name: '__proto__',
			encode: { x: 'timestamp', y: '__proto__' }
		}
		chart.seriesMeta[0] = { ...chart.seriesMeta[0], name: '__proto__' }

		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, grouping: 'quarter', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		const row = transformed.props.dataset.source[0]
		expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
		expect(Object.hasOwn(row, '__proto__')).toBe(true)
		expect(row.__proto__).toBe(60)
	})

	it('normalizes negative, missing, and zero percentage buckets without mutating input', () => {
		const chart = makeMixedAxisChart('time')
		chart.props.dataset.source = [
			{ timestamp: Date.UTC(2026, 0, 1), 'Primary A': -20, 'Primary B': 30, Secondary: 5 },
			{ timestamp: Date.UTC(2026, 0, 2), 'Primary B': 10, Secondary: 6 },
			{ timestamp: Date.UTC(2026, 0, 3), 'Primary A': 0, 'Primary B': 0, Secondary: 7 }
		]
		chart.rowCount = chart.props.dataset.source.length
		deepFreeze(chart)

		const transformed = ChartDataTransformer.applyViewState(chart, { ...viewState, stacked: true }, capabilities)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			{ timestamp: Date.UTC(2026, 0, 1), 'Primary A': -40, 'Primary B': 60, Secondary: 5 },
			{ timestamp: Date.UTC(2026, 0, 2), 'Primary A': 0, 'Primary B': 100, Secondary: 6 },
			{ timestamp: Date.UTC(2026, 0, 3), 'Primary A': 0, 'Primary B': 0, Secondary: 7 }
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
		expect(chart.props.dataset.source[1]).not.toHaveProperty('Primary A')
		expect(chart.props.dataset.source[0]?.['Primary A']).toBe(-20)
	})

	it('groups legacy string timestamps and skips malformed timestamps', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeLegacyTimestampChart(),
			{ ...viewState, grouping: 'month', percentage: false },
			{ ...capabilities, allowGrouping: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 10 },
			{ timestamp: Date.UTC(2026, 1, 1), Revenue: 20 },
			{ timestamp: Date.UTC(2026, 2, 1), Revenue: 30 },
			{ timestamp: Date.UTC(2026, 3, 1), Revenue: 40 }
		])
	})

	it('applies cumulative view to legacy string timestamps and skips malformed timestamps', () => {
		const transformed = ChartDataTransformer.applyViewState(
			makeLegacyTimestampChart(),
			{ ...viewState, cumulative: true, percentage: false },
			{ ...capabilities, allowCumulative: true }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		expect(transformed.props.dataset.source).toEqual([
			{ timestamp: Date.UTC(2026, 0, 1), Revenue: 10 },
			{ timestamp: Date.UTC(2026, 1, 1), Revenue: 30 },
			{ timestamp: Date.UTC(2026, 2, 1), Revenue: 60 },
			{ timestamp: Date.UTC(2026, 3, 1), Revenue: 100 }
		])
	})

	it('leaves log-axis policy to the renderer', () => {
		const chart = makeMixedAxisChart('time')
		chart.props.chartOptions = { yAxis: [{ min: 0 }, { min: 0 }] } as any

		const transformed = ChartDataTransformer.applyViewState(
			chart,
			{ ...viewState, percentage: false, logScale: true },
			{ ...capabilities, allowPercentage: false, allowLogScale: true, logEligibleYAxes: [0] }
		)
		if (transformed.chartType !== 'cartesian') throw new Error('Expected cartesian chart')

		const yAxis = transformed.props.chartOptions?.yAxis as unknown as any[]

		expect(yAxis).toEqual([{ min: 0 }, { min: 0 }])
	})
})

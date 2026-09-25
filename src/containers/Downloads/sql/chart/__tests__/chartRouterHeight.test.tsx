// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChartConfig, ChartType } from '../../chartConfig'
import { classifyColumns } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { SQL_CHART_HEIGHT } from '../chartLayout'
import { ChartRouter } from '../index'

// ECharts needs a canvas that happy-dom lacks, so each chart library entry is replaced by a
// stub that exposes the height it was given.
function stub({ height }: { height?: string }) {
	return <div data-chart-height={height} />
}

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: stub }))
vi.mock('~/components/ECharts/HBarChart', () => ({ default: stub }))
vi.mock('~/components/ECharts/PieChart', () => ({ default: stub }))
vi.mock('~/components/ECharts/TreemapChart', () => ({ default: stub }))
vi.mock('~/components/ECharts/ScatterChart', () => ({ default: stub }))
vi.mock('~/components/ECharts/CandlestickChart', () => ({ default: stub }))

const result: QueryResult = {
	columns: [
		{ name: 'day', type: 'TIMESTAMP' },
		{ name: 'label', type: 'VARCHAR' },
		{ name: 'value', type: 'DOUBLE' },
		{ name: 'other', type: 'DOUBLE' },
		{ name: 'size', type: 'DOUBLE' }
	],
	rows: [
		[1_767_225_600_000, 'a', 1, 2, 5],
		[1_767_312_000_000, 'b', 3, 4, 6]
	]
}
const classified = classifyColumns(result)
const config: ChartConfig = {
	chartType: 'line',
	xCol: 'day',
	yCols: ['value', 'other'],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto',
	candlestick: { ts: 'day', open: 'value', close: 'other', low: 'value', high: 'other' }
}

const chartTypes: Array<ChartType> = [
	'line',
	'bar',
	'area',
	'areaStacked',
	'areaPct',
	'hbar',
	'scatter',
	'bubble',
	'pie',
	'donut',
	'treemap',
	'histogram',
	'candlestick'
]

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderChart(chartType: ChartType, height?: string) {
	await act(async () =>
		root.render(
			<ChartRouter
				config={{ ...config, chartType }}
				result={result}
				classified={classified}
				{...(height === undefined ? {} : { height })}
			/>
		)
	)
	await act(async () => {})
	return container.querySelector('[data-chart-height]')?.getAttribute('data-chart-height')
}

test('a SQL chart without a caller height renders at the shared base height', async () => {
	expect(await renderChart('treemap')).toBe(SQL_CHART_HEIGHT)
})

test.each(chartTypes)('%s renders at the height the caller asks for', async (chartType) => {
	expect(await renderChart(chartType, '315px')).toBe('315px')
})

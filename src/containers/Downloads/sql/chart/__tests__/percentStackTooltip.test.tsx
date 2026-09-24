// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { ChartConfig } from '../../chartConfig'
import { classifyColumns } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { LineBarChart } from '../adapters/LineBarChart'

type Rendered = {
	dataset: { source: Array<Array<number | string | null>> }
	valueSymbol: string
	chartOptions: { tooltip: { formatter: (params: unknown) => string } }
}
const rendered: Array<Rendered> = []
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: (props: Rendered) => {
		rendered.push(props)
		return null
	}
}))

// Fees of 25 and 75 in one row: a 25% and a 75% share.
function render(
	xType: 'TIMESTAMP' | 'VARCHAR',
	stackMode: ChartConfig['stackMode'],
	values: [number, number] = [25, 75]
) {
	const result: QueryResult = {
		columns: [
			{ name: 'x', type: xType },
			{ name: 'a', type: 'DOUBLE' },
			{ name: 'b', type: 'DOUBLE' }
		],
		rows: [[xType === 'TIMESTAMP' ? 1_767_225_600_000 : 'Ethereum', ...values]]
	}
	const config: ChartConfig = {
		chartType: 'bar',
		xCol: 'x',
		yCols: ['a', 'b'],
		splitByCol: null,
		stackMode,
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'currency'
	}
	return act(async () => {
		createRoot(document.createElement('div')).render(
			<LineBarChart config={config} result={result} classified={classifyColumns(result)} />
		)
	})
}

function hoverFirstSeries({ dataset, chartOptions }: Rendered) {
	const row = dataset.source[0]!
	return chartOptions.tooltip.formatter([
		{ seriesName: 'a', marker: '', axisValue: row[0], name: row[0], value: row, encode: { x: [0], y: [1] } }
	])
}

test.each(['TIMESTAMP', 'VARCHAR'] as const)('labels full-stack shares as percents on a %s axis', async (xType) => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	rendered.length = 0
	await render(xType, 'expand')
	const chart = rendered.at(-1)!

	expect(chart.valueSymbol).toBe('%')
	expect(hoverFirstSeries(chart)).toContain('25 %')
	expect(hoverFirstSeries(chart)).not.toContain('$')
})

test('keeps the column format when the series stack normally', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	rendered.length = 0
	await render('VARCHAR', 'stacked')

	expect(hoverFirstSeries(rendered.at(-1)!)).toContain('$25')
})

test.each(['TIMESTAMP', 'VARCHAR'] as const)(
	'leaves a row without a positive total empty on a %s axis',
	async (xType) => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		rendered.length = 0
		// 200 and -200 total zero: neither has a share of the row.
		await render(xType, 'expand', [200, -200])

		expect(rendered.at(-1)!.dataset.source[0]!.slice(1)).toEqual([null, null])
	}
)

import { expect, test } from 'vitest'
import type { ChartConfig } from '../../chartConfig'
import { classifyColumns } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { buildLineBarChart } from '../adapters/LineBarChart'

// Fees of 25 and 75 in one row: a 25% and a 75% share.
function build(
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
	return buildLineBarChart(config, result, classifyColumns(result), {})
}

function hoverFirstSeries({ chartModel, chartOptions }: ReturnType<typeof build>) {
	const row = chartModel.dataset.source[0]!
	const formatter = (chartOptions.tooltip as unknown as { formatter: (params: unknown) => string }).formatter
	return formatter([
		{ seriesName: 'a', marker: '', axisValue: row[0], name: row[0], value: row, encode: { x: [0], y: [1] } }
	])
}

test.each(['TIMESTAMP', 'VARCHAR'] as const)('labels full-stack shares as percents on a %s axis', (xType) => {
	const chart = build(xType, 'expand')

	expect(chart.valueSymbol).toBe('%')
	expect(hoverFirstSeries(chart)).toContain('25 %')
	expect(hoverFirstSeries(chart)).not.toContain('$')
})

test('keeps the column format when the series stack normally', () => {
	expect(hoverFirstSeries(build('VARCHAR', 'stacked'))).toContain('$25')
})

test.each(['TIMESTAMP', 'VARCHAR'] as const)('leaves a row without a positive total empty on a %s axis', (xType) => {
	// 200 and -200 total zero: neither has a share of the row.
	expect(build(xType, 'expand', [200, -200]).chartModel.dataset.source[0]!.slice(1)).toEqual([null, null])
})

import { describe, expect, test } from 'vitest'
import { assignUniqueColors, CHART_SERIES_LIMIT, chartColor } from '~/constants/colors'
import { assignStackColors } from '../stackColors'
import type { MultiSeriesChartArrayRow, MultiSeriesChartSeriesConfig } from '../types'

const SERIES = CHART_SERIES_LIMIT + 2
const charts: Array<MultiSeriesChartSeriesConfig> = Array.from({ length: SERIES }, (_, index) => ({
	name: `Series ${index}`,
	type: 'line',
	stack: 'A',
	encode: { x: 0, y: index + 1 },
	// What a caller ranking its series passes: the palette cycles past the limit.
	color: chartColor(index)
}))
const stack = new Set(charts.map((chart) => chart.name))

/** Rows where only `values` (series index -> value) are drawn. */
function rows(count: number, values: Record<number, number>): Array<MultiSeriesChartArrayRow> {
	return Array.from({ length: count }, (_, row) => [
		row,
		...Array.from({ length: SERIES }, (_value, index) => values[index] ?? 0)
	])
}
const everyTopSeries: Record<number, number> = {}
for (let index = 0; index < CHART_SERIES_LIMIT; index++) everyTopSeries[index] = 10

describe('stack colors past the palette', () => {
	test('keep the top palette series and keep series that fill the chart together apart', () => {
		// Early on, Series 1 and the two series past the limit fill the chart; later only the top ten.
		const early = { 1: 30, [CHART_SERIES_LIMIT]: 30, [CHART_SERIES_LIMIT + 1]: 30 }
		const colors = assignStackColors({ charts, stack, source: [...rows(10, early), ...rows(10, everyTopSeries)] })

		expect(colors?.has('Series 0')).toBe(false)
		// Never drawn beside Series 0, so it may share its color.
		expect(colors?.get(`Series ${CHART_SERIES_LIMIT}`)).toBe(chartColor(0))
		// Drawn beside the series above and Series 1, so it takes neither color: the first free one.
		expect(colors?.get(`Series ${CHART_SERIES_LIMIT + 1}`)).toBe(chartColor(2))
	})

	test('move a series off the color of a top series it is drawn beside', () => {
		// Series 10 cycles to Series 0's color and fills the chart with it.
		const source = [...rows(10, { 0: 50, [CHART_SERIES_LIMIT]: 50 }), ...rows(10, everyTopSeries)]
		const colors = assignStackColors({ charts, stack, source })

		// Every other color overlaps nothing and is used once, so the tie goes to the first of them.
		expect(colors?.get(`Series ${CHART_SERIES_LIMIT}`)).toBe(chartColor(1))
	})

	test('leave a stack of palette series alone, whatever brand colors it adds', () => {
		const branded = charts.map((chart, index) => (index >= CHART_SERIES_LIMIT ? { ...chart, color: '#123456' } : chart))
		const source = rows(10, { 0: 50, [CHART_SERIES_LIMIT]: 50 })

		expect(assignStackColors({ charts: branded, stack, source })).toBeNull()
	})

	test('move a picked series off a color it repeats, to the one the pie beside it uses', () => {
		// The user picked ranks 1 and 11, which the palette cycle colors alike.
		const picked = [charts[0]!, charts[CHART_SERIES_LIMIT]!]
		const colors = assignStackColors({
			charts: picked,
			stack: new Set(picked.map((chart) => chart.name)),
			source: rows(10, { 0: 50, [CHART_SERIES_LIMIT]: 50 })
		})
		const pie = assignUniqueColors(picked.map((chart) => ({ name: chart.name, color: chart.color! })))

		expect(colors?.get(`Series ${CHART_SERIES_LIMIT}`)).not.toBe(chartColor(0))
		expect(colors?.get(`Series ${CHART_SERIES_LIMIT}`)).toBe(pie[`Series ${CHART_SERIES_LIMIT}`])
	})

	test('give picked series the same colors a pie of the same picks gives, whatever their history', () => {
		// Ranks 1, 2, 11 and 12, where rank 12 filled more of the chart's history than rank 11.
		const picked = [charts[0]!, charts[1]!, charts[CHART_SERIES_LIMIT]!, charts[CHART_SERIES_LIMIT + 1]!]
		const colors = assignStackColors({
			charts: picked,
			stack: new Set(picked.map((chart) => chart.name)),
			source: rows(10, { 0: 10, 1: 10, [CHART_SERIES_LIMIT]: 5, [CHART_SERIES_LIMIT + 1]: 80 })
		})
		const pie = assignUniqueColors(picked.map((chart) => ({ name: chart.name, color: chart.color! })))

		for (const name of [`Series ${CHART_SERIES_LIMIT}`, `Series ${CHART_SERIES_LIMIT + 1}`]) {
			expect(colors?.get(name)).toBe(pie[name])
		}
	})
})

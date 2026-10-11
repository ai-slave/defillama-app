import { describe, expect, test } from 'vitest'
import { CHART_SERIES_LIMIT, chartColor, OTHERS_COLOR } from '~/constants/colors'
import { buildSqlPieData } from '../PieChartAdapter'

describe('buildSqlPieData', () => {
	test('keeps one reconciled Other slice, last and gray, when a real Other category would rank in the top set', () => {
		const rows = [['Other', 100], ...Array.from({ length: 12 }, (_, index) => [`Item ${index}`, 20 - index])]
		const result = buildSqlPieData(rows, 0, 1, {})

		expect(result.truncated).toBe(2)
		expect(result.chartData).toHaveLength(CHART_SERIES_LIMIT + 1)
		expect(result.chartData.at(-1)).toEqual({ name: 'Other', value: 119 })
		expect(result.stackColors['Item 0']).toBe(chartColor(0))
		expect(result.stackColors.Other).toBe(OTHERS_COLOR)
	})

	test('keeps null categories in a reconciled empty bucket', () => {
		const result = buildSqlPieData(
			[
				[null, 2],
				['Owned', 3]
			],
			0,
			1,
			{}
		)

		expect(result.chartData).toEqual([
			{ name: 'Owned', value: 3 },
			{ name: '∅', value: 2 }
		])
	})
})

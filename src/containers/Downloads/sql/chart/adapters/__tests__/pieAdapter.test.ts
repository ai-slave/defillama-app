import { describe, expect, it } from 'vitest'
import { buildSqlPieData } from '../PieChartAdapter'

describe('buildSqlPieData', () => {
	it('keeps one reconciled Other slice when a real Other category is already in the top set', () => {
		const rows = [['Other', 100], ...Array.from({ length: 12 }, (_, index) => [`Item ${index}`, 20 - index])]
		const result = buildSqlPieData(rows, 0, 1, {})

		expect(result.truncated).toBe(1)
		expect(result.chartData.filter((item) => item.name === 'Other')).toEqual([{ name: 'Other', value: 109 }])
	})

	it('keeps null categories in a reconciled empty bucket', () => {
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

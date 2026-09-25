import { describe, expect, test } from 'vitest'
import { buildSqlHBarData } from '../HBarChartAdapter'

describe('buildSqlHBarData', () => {
	test('keeps the largest rows in first-seen order for ties, smallest bar first', () => {
		const rows = [
			['A', 5],
			['B', 9],
			['C', 5],
			['D', 7],
			['E', 9],
			['F', 1],
			// Arrives once the list is full and takes the last slot.
			['G', 6]
		]
		expect(buildSqlHBarData(rows, 0, 1, 4)).toEqual({
			categories: ['G', 'D', 'E', 'B'],
			values: [6, 7, 9, 9]
		})
	})

	test('shows 40 bars by default', () => {
		const rows = Array.from({ length: 41 }, (_, index) => [`Row ${index}`, index])
		const { categories } = buildSqlHBarData(rows, 0, 1)
		expect(categories).toHaveLength(40)
		expect(categories[0]).toBe('Row 1')
	})

	test('ignores empty labels and nonnumeric SQL values', () => {
		expect(
			buildSqlHBarData(
				[
					[null, 10],
					['A', '']
				],
				0,
				1
			)
		).toEqual({
			categories: [],
			values: []
		})
	})
})

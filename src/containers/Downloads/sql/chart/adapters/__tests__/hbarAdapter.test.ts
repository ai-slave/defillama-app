import { describe, expect, test } from 'vitest'
import { buildSqlHBarData } from '../HBarChartAdapter'

describe('buildSqlHBarData', () => {
	test('matches a stable full sort while retaining only the configured top rows', () => {
		const rows = Array.from({ length: 1000 }, (_, index) => [`Row ${index}`, (index * 17) % 53])
		const expected = rows
			.map((row) => ({ name: row[0] as string, value: row[1] as number }))
			.sort((a, b) => b.value - a.value)
			.slice(0, 40)
			.reverse()

		expect(buildSqlHBarData(rows, 0, 1)).toEqual({
			categories: expected.map((row) => row.name),
			values: expected.map((row) => row.value)
		})
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

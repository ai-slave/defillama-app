import { describe, expect, test } from 'vitest'
import { buildSqlTreemapNodes } from '../TreemapChartAdapter'

describe('buildSqlTreemapNodes', () => {
	test('aggregates executor-normalized SQL values into canonical grouped nodes', () => {
		expect(
			buildSqlTreemapNodes(
				[
					['Aave', 'Lending', 12.5],
					['Compound', 'Lending', 20],
					['Broken', 'Lending', 'unknown'],
					[null, null, 3]
				],
				0,
				2,
				1
			)
		).toEqual([
			{
				name: 'Lending',
				value: [32.5, 0, 0],
				children: [
					{ name: 'Compound', value: [20, 0, 0] },
					{ name: 'Aave', value: [12.5, 0, 0] }
				]
			},
			{ name: '∅', value: [3, 0, 0], children: [{ name: '∅', value: [3, 0, 0] }] }
		])
	})

	test('keeps flat aggregation and value ordering at the adapter boundary', () => {
		expect(
			buildSqlTreemapNodes(
				[
					['Aave', 2],
					['Aave', 3],
					['Lido', 10]
				],
				0,
				1,
				null
			)
		).toEqual([
			{ name: 'Lido', value: [10, 0, 0] },
			{ name: 'Aave', value: [5, 0, 0] }
		])
	})

	test('keeps null names in the empty bucket', () => {
		expect(buildSqlTreemapNodes([[null, 10]], 0, 1, null)).toEqual([{ name: '∅', value: [10, 0, 0] }])
	})
})

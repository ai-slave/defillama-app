import { describe, expect, it } from 'vitest'
import { buildSqlTreemapNodes } from '../TreemapChartAdapter'

describe('buildSqlTreemapNodes', () => {
	it('normalizes SQL scalar values once and emits canonical grouped nodes', () => {
		expect(
			buildSqlTreemapNodes(
				[
					{ protocol: 'Aave', category: 'Lending', tvl: '12.5' },
					{ protocol: 'Compound', category: 'Lending', tvl: 20n },
					{ protocol: 'Broken', category: 'Lending', tvl: 'unknown' },
					{ protocol: null, category: null, tvl: 3 }
				],
				'protocol',
				'tvl',
				'category'
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

	it('keeps flat aggregation and value ordering at the adapter boundary', () => {
		expect(
			buildSqlTreemapNodes(
				[
					{ protocol: 'Aave', tvl: '2' },
					{ protocol: 'Aave', tvl: 3 },
					{ protocol: 'Lido', tvl: 10 }
				],
				'protocol',
				'tvl',
				null
			)
		).toEqual([
			{ name: 'Lido', value: [10, 0, 0] },
			{ name: 'Aave', value: [5, 0, 0] }
		])
	})
})

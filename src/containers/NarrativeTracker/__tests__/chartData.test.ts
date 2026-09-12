import { describe, expect, test } from 'vitest'
import {
	buildNarrativeTreemapTreeData,
	calculateDenominatedTimeSeries,
	calculateDenominatedChange,
	filterNarrativeTreemapTreeData
} from '../chartData'
import type { IPctChangeRow } from '../types'

function row(overrides: Partial<IPctChangeRow>): IPctChangeRow {
	return {
		id: overrides.id ?? overrides.name?.toLowerCase() ?? 'row',
		name: overrides.name ?? 'Row',
		mcap: overrides.mcap === undefined ? 0 : overrides.mcap,
		volume1D: overrides.volume1D ?? null,
		change1W: null,
		change1M: null,
		change1Y: null,
		changeYtd: null,
		...overrides
	}
}

describe('buildNarrativeTreemapTreeData', () => {
	test('groups rows by first-seen category while preserving child order', () => {
		expect(
			buildNarrativeTreemapTreeData([
				row({ name: 'Aave', categoryName: 'Lending', mcap: 100, returnField: 12.345 }),
				row({ name: 'Uniswap', categoryName: 'DEX', mcap: 50, returnField: -1.234 }),
				row({ name: 'Compound', categoryName: 'Lending', mcap: 25, returnField: null })
			])
		).toEqual([
			{
				value: [125, null, null, 0],
				name: 'Lending',
				path: 'Lending',
				children: [
					{ value: [100, 12.35, 12.35, 100], name: 'Aave', path: 'Lending/Aave' },
					{ value: [25, 0, 0, 0], name: 'Compound', path: 'Lending/Compound' }
				]
			},
			{
				value: [50, null, null, 0],
				name: 'DEX',
				path: 'DEX',
				children: [{ value: [50, -1.23, -1.23, -100], name: 'Uniswap', path: 'DEX/Uniswap' }]
			}
		])
	})

	test('keeps the previous blank category path for rows without a category name', () => {
		expect(buildNarrativeTreemapTreeData([row({ name: 'Bitcoin', mcap: 500, returnField: null })])).toEqual([
			{
				value: [500, null, null, 0],
				name: '',
				path: '',
				children: [{ value: [500, 0, 0, 0], name: 'Bitcoin', path: '/Bitcoin' }]
			}
		])
	})

	test('uses zero treemap weight for coins without market cap data', () => {
		expect(buildNarrativeTreemapTreeData([row({ name: 'SpiritSwap', mcap: null, returnField: 1.23 })])).toEqual([
			{
				value: [0, null, null, 0],
				name: '',
				path: '',
				children: [{ value: [0, 1.23, 1.23, 100], name: 'SpiritSwap', path: '/SpiritSwap' }]
			}
		])
	})

	test('keeps value-color gradients local to each sibling group', () => {
		const tree = buildNarrativeTreemapTreeData([
			row({ name: 'Low', categoryName: 'Lending', returnField: -10 }),
			row({ name: 'Mid loss', categoryName: 'Lending', returnField: -5 }),
			row({ name: 'Mid gain', categoryName: 'Lending', returnField: 10 }),
			row({ name: 'High', categoryName: 'Lending', returnField: 20 }),
			row({ name: 'Only gain', categoryName: 'DEX', returnField: 10 })
		])

		expect(tree[0].children.map((node) => node.value[3])).toEqual([-100, -70, 70, 100])
		expect(tree[1].children[0].value[3]).toBe(100)
	})

	test('reads the selected period directly without an intermediate row copy', () => {
		const tree = buildNarrativeTreemapTreeData(
			[
				row({ name: 'Aave', categoryName: 'Lending', returnField: -99, change1M: 12.345 }),
				row({ name: 'Compound', categoryName: 'Lending', returnField: 99, change1M: -1.234 })
			],
			'change1M'
		)

		expect(tree[0].children.map((node) => node.value.slice(1))).toEqual([
			[12.35, 12.35, 100],
			[-1.23, -1.23, -100]
		])
	})

	test('filters coins without recalculating their full-market color intensity', () => {
		const tree = buildNarrativeTreemapTreeData([
			row({ name: 'Low', categoryName: 'Lending', mcap: 3, returnField: 10 }),
			row({ name: 'High', categoryName: 'Lending', mcap: 7, returnField: 20 })
		])

		expect(filterNarrativeTreemapTreeData(tree, new Set(['Low']))).toEqual([
			{
				...tree[0],
				value: [3, null, null, 0],
				children: [tree[0].children[0]]
			}
		])
		expect(tree[0].children[0].value[3]).toBe(70)
	})

	test('filters whole category nodes on the category overview', () => {
		const tree = buildNarrativeTreemapTreeData([
			row({ name: 'Lending', categoryName: 'Lending', mcap: 3 }),
			row({ name: 'DEX', categoryName: 'DEX', mcap: 7 })
		])

		expect(filterNarrativeTreemapTreeData(tree, new Set(['DEX']))).toEqual([tree[1]])
	})

	test('filters overview rows by name when their category name is missing', () => {
		const tree = buildNarrativeTreemapTreeData(
			[row({ name: 'Lending', mcap: 3, change1M: 10 }), row({ name: 'DEX', mcap: 7, change1M: 20 })],
			'change1M'
		)

		expect(filterNarrativeTreemapTreeData(tree, new Set(['Lending', 'DEX']))).toEqual(tree)
		expect(filterNarrativeTreemapTreeData(tree, new Set(['Lending']))).toEqual([
			{ ...tree[0], value: [3, null, null, 0], children: [tree[0].children[0]] }
		])
		expect(filterNarrativeTreemapTreeData(tree, new Set())).toEqual([])
		expect(tree[0].children).toHaveLength(2)
		expect(tree[0].children[0].value[3]).toBe(70)
	})
})

describe('calculateDenominatedTimeSeries', () => {
	test('preserves ascending input order and converts returns relative to the selected denomination', () => {
		const result = calculateDenominatedTimeSeries(
			[
				{ date: 1, Bitcoin: 0, DeFi: 10, Gaming: 5 },
				{ date: 2, Bitcoin: 10, DeFi: 21, Gaming: -1 }
			],
			'Bitcoin'
		)

		expect(result.map((entry) => entry.date)).toEqual([1, 2])
		expect(result[0].DeFi).toBeCloseTo(10)
		expect(result[0].Gaming).toBeCloseTo(5)
		expect(result[0].Bitcoin).toBeUndefined()
		expect(result[1].DeFi).toBeCloseTo(10)
		expect(result[1].Gaming).toBeCloseTo(-10)
		expect(result[1].Bitcoin).toBeUndefined()
	})

	test('converts later rows when the first row lacks the selected denomination', () => {
		const rows = [
			{ date: 1, DeFi: 10 },
			{ date: 2, DeFi: 20, Bitcoin: 1 }
		]

		const result = calculateDenominatedTimeSeries(rows, 'Bitcoin')

		expect(result[0]).toEqual({ date: 1 })
		expect(result[1].date).toBe(2)
		expect(result[1].DeFi).toBeCloseTo(18.811881)
		expect(result[1].Bitcoin).toBeUndefined()
	})

	test('withholds relative returns when no row has the selected denomination', () => {
		const rows = [
			{ date: 1, DeFi: 10 },
			{ date: 2, DeFi: 20 }
		]

		expect(calculateDenominatedTimeSeries(rows, 'Bitcoin')).toEqual([{ date: 1 }, { date: 2 }])
	})

	test('returns date-only rows when denomination performance is zero or missing for a day', () => {
		const result = calculateDenominatedTimeSeries(
			[
				{ date: 1, Bitcoin: 0, DeFi: 10 },
				{ date: 2, Bitcoin: -100, DeFi: 20 },
				{ date: 3, DeFi: 30 }
			],
			'Bitcoin'
		)

		expect(result[0].date).toBe(1)
		expect(result[0].DeFi).toBeCloseTo(10)
		expect(result[1]).toEqual({ date: 2 })
		expect(result[2]).toEqual({ date: 3 })
	})
})

describe('calculateDenominatedChange', () => {
	test('withholds relative returns without a benchmark or with a zero denominator', () => {
		const rows = [row({ name: 'DeFi', change1W: 21 }), row({ name: 'Bitcoin', change1W: null })]
		expect(calculateDenominatedChange(rows, 'Bitcoin', 'change1W').map((item) => item.change1W)).toEqual([null, null])
		rows[1].change1W = -100
		expect(calculateDenominatedChange(rows, 'Bitcoin', 'change1W').map((item) => item.change1W)).toEqual([null, null])
	})

	test('converts valid relative returns and preserves missing category values', () => {
		const rows = [row({ name: 'DeFi', change1W: 21 }), row({ name: 'Bitcoin', change1W: 10 }), row({ name: 'Gaming' })]
		const result = calculateDenominatedChange(rows, 'Bitcoin', 'change1W')
		expect(result[0].change1W).toBeCloseTo(10)
		expect(result[1].change1W).toBeCloseTo(0)
		expect(result[2].change1W).toBeNull()
		expect(rows[0].change1W).toBe(21)
	})

	test('preserves USD returns without requiring token benchmarks', () => {
		const rows = [row({ name: 'DeFi', change1W: 21 })]
		expect(calculateDenominatedChange(rows, '$', 'change1W')).toBe(rows)
		const series = [{ date: 1, DeFi: 21 }]
		expect(calculateDenominatedTimeSeries(series, '$')).toBe(series)
	})
})

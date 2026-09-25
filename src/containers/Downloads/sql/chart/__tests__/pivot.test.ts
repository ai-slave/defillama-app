import { describe, expect, test } from 'vitest'
import { pivotRowsForSplit } from '../pivot'

describe('pivotRowsForSplit', () => {
	test('pivots long into wide', () => {
		const rows = [
			[1, 10, 'eth'],
			[1, 5, 'arb'],
			[2, 12, 'eth'],
			[2, 6, 'arb']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.keys).toEqual(['eth', 'arb'])
		expect(result.rows).toHaveLength(2)
		expect(result.rows[0]).toEqual([1, 10, 5])
		expect(result.rows[1]).toEqual([2, 12, 6])
		expect(result.truncatedCount).toBe(0)
	})

	test('sums duplicate (x, split) pairs', () => {
		const rows = [
			[1, 1, 'a'],
			[1, 2, 'a'],
			[1, 3, 'b']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.rows[0][1]).toBe(3)
		expect(result.rows[0][2]).toBe(3)
	})

	test('folds beyond top-N into Other', () => {
		const rows: Array<Array<unknown>> = []
		for (let i = 0; i < 25; i++) rows.push([1, 100 - i, `k${i}`])
		const result = pivotRowsForSplit(rows, 0, 1, 2, { topN: 5 })
		expect(result.keys).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'Other'])
		expect(result.truncatedCount).toBe(20)
		// Other holds the sum of k5..k24: 95 + 94 + ... + 76.
		expect(result.rows[0]).toEqual([1, 100, 99, 98, 97, 96, 1710])
	})

	test('preserves numeric X sort order', () => {
		const rows = [
			[2, 1, 'a'],
			[1, 2, 'a'],
			[3, 3, 'a']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.rows.map((r) => r[0])).toEqual([1, 2, 3])
	})

	test('treats null splits as a distinct bucket', () => {
		const rows = [
			[1, 1, null],
			[1, 2, 'a']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.keys).toContain('∅')
		expect(result.keys).toContain('a')
	})

	test('keeps split labels separate from the x value', () => {
		const result = pivotRowsForSplit([['2026-01-01', 5, 'date']], 0, 1, 2)

		expect(result.keys).toEqual(['date'])
		expect(result.rows[0]).toEqual(['2026-01-01', 5])
	})

	test('folds the tail into an existing Other bucket without duplicating it', () => {
		const rows = [
			['A', 10, 'Other'],
			['A', 5, 'small']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2, { topN: 1 })

		expect(result.keys).toEqual(['Other'])
		expect(result.rows[0]).toEqual(['A', 15])
		expect(result.truncatedCount).toBe(1)
	})
})

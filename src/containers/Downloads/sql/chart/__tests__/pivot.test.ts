import { describe, expect, it } from 'vitest'
import { pivotRowsForSplit } from '../pivot'

describe('pivotRowsForSplit', () => {
	it('pivots long into wide', () => {
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

	it('sums duplicate (x, split) pairs', () => {
		const rows = [
			[1, 1, 'a'],
			[1, 2, 'a'],
			[1, 3, 'b']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.rows[0][1]).toBe(3)
		expect(result.rows[0][2]).toBe(3)
	})

	it('folds beyond top-N into Other', () => {
		const rows: unknown[][] = []
		for (let i = 0; i < 25; i++) rows.push([1, 10 - i / 100, `k${i}`])
		const result = pivotRowsForSplit(rows, 0, 1, 2, { topN: 5 })
		expect(result.keys).toHaveLength(6) // 5 + Other
		expect(result.keys[5]).toBe('Other')
		expect(result.truncatedCount).toBe(20)
		const otherValue = result.rows[0][6] as number
		expect(otherValue).toBeGreaterThan(0)
	})

	it('handles all-in-one bucket', () => {
		const rows = [
			[1, 5, 'only'],
			[2, 6, 'only']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.keys).toEqual(['only'])
		expect(result.truncatedCount).toBe(0)
	})

	it('preserves numeric X sort order', () => {
		const rows = [
			[2, 1, 'a'],
			[1, 2, 'a'],
			[3, 3, 'a']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.rows.map((r) => r[0])).toEqual([1, 2, 3])
	})

	it('treats null splits as a distinct bucket', () => {
		const rows = [
			[1, 1, null],
			[1, 2, 'a']
		]
		const result = pivotRowsForSplit(rows, 0, 1, 2)
		expect(result.keys).toContain('∅')
		expect(result.keys).toContain('a')
	})

	it('keeps split labels separate from the x value', () => {
		const result = pivotRowsForSplit([['2026-01-01', 5, 'date']], 0, 1, 2)

		expect(result.keys).toEqual(['date'])
		expect(result.rows[0]).toEqual(['2026-01-01', 5])
	})

	it('folds the tail into an existing Other bucket without duplicating it', () => {
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

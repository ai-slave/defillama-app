import { expect, test } from 'vitest'
import { percentileOpacity, rankOpacity } from '../colors'

test('gives stronger percentiles no weaker emphasis and leaves missing values unhighlighted', () => {
	const values = [0, 9.9, 10, 49.9, 50, 79, 80, 99, 100].map(percentileOpacity)
	expect(values).toEqual(values.toSorted((a, b) => a - b))
	expect(values.at(-1)).toBeGreaterThan(values[0])
	expect(percentileOpacity(null)).toBe(0)
	expect(percentileOpacity(undefined)).toBe(0)
})

test('gives better ranks no weaker emphasis and leaves missing ranks unhighlighted', () => {
	const values = [1, 2, 3, 4, 5, 6, 20].map(rankOpacity)
	expect(values).toEqual(values.toSorted((a, b) => b - a))
	expect(values[0]).toBeGreaterThan(values.at(-1)!)
	expect(rankOpacity(null)).toBe(0)
	expect(rankOpacity(undefined)).toBe(0)
})

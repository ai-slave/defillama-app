import { describe, expect, test } from 'vitest'
import { findClosestChartValue } from './CollectionScatterChart'

const rows: Array<[number, number]> = [
	[1000, 1],
	[2000, 2],
	[4000, 4]
]

describe('findClosestChartValue', () => {
	test('handles empty input and targets outside the available range', () => {
		expect(findClosestChartValue([], 1000, 1)).toBe('0')
		expect(findClosestChartValue(rows, 100, 1)).toBe('1.00')
		expect(findClosestChartValue(rows, 5000, 1)).toBe('4.00')
	})

	test('finds exact and nearest values with an earlier-value tie break', () => {
		expect(findClosestChartValue(rows, 2000, 1)).toBe('2.00')
		expect(findClosestChartValue(rows, 3500, 1)).toBe('4.00')
		expect(findClosestChartValue(rows, 3000, 1)).toBe('2.00')
	})

	test('compares second-based API rows against millisecond chart timestamps', () => {
		expect(
			findClosestChartValue(
				[
					[1, 10],
					[2, 20]
				],
				1750,
				1000
			)
		).toBe('20.00')
	})
})

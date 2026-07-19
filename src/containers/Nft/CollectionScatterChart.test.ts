import { describe, expect, it } from 'vitest'
import { findClosestChartValue } from './CollectionScatterChart'

const rows: Array<[number, number]> = [
	[1_000, 1],
	[2_000, 2],
	[4_000, 4]
]

describe('findClosestChartValue', () => {
	it('handles empty input and targets outside the available range', () => {
		expect(findClosestChartValue([], 1_000, 1)).toBe('0')
		expect(findClosestChartValue(rows, 100, 1)).toBe('1.00')
		expect(findClosestChartValue(rows, 5_000, 1)).toBe('4.00')
	})

	it('finds exact and nearest values with an earlier-value tie break', () => {
		expect(findClosestChartValue(rows, 2_000, 1)).toBe('2.00')
		expect(findClosestChartValue(rows, 3_500, 1)).toBe('4.00')
		expect(findClosestChartValue(rows, 3_000, 1)).toBe('2.00')
	})

	it('compares second-based API rows against millisecond chart timestamps', () => {
		expect(
			findClosestChartValue(
				[
					[1, 10],
					[2, 20]
				],
				1_750,
				1000
			)
		).toBe('20.00')
	})
})

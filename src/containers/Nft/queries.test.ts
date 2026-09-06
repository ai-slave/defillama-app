import { describe, expect, test } from 'vitest'
import { buildRollingMedianSeries } from './queries'

const HOUR = 60 * 60 * 1000

describe('buildRollingMedianSeries', () => {
	test('returns no rows for an empty sales history', () => {
		expect(buildRollingMedianSeries([])).toEqual([])
	})

	test('advances ascending window bounds and computes the same six-hour medians', () => {
		expect(
			buildRollingMedianSeries([
				[0, 1],
				[HOUR, 9],
				[6 * HOUR, 5],
				[12 * HOUR, 7]
			])
		).toEqual([
			[0, 1],
			[6 * HOUR, 5],
			[12 * HOUR, 6]
		])
	})

	test('uses a 24-hour window for large histories while retaining the boundary point', () => {
		const sales: Array<[number, number]> = []
		for (let i = 0; i < 301; i++) sales.push([i * HOUR, i])

		const output = buildRollingMedianSeries(sales)
		const last = output[output.length - 1]

		expect(last[0]).toBe(300 * HOUR)
		expect(last[1]).toBe(288)
	})
})

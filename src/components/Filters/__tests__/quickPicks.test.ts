import { describe, expect, test } from 'vitest'
import { inRange, rangeQuickPicks } from '../quickPicks'

const LADDER = [100, 1000, 10_000]

describe('range quick picks', () => {
	test('offers a step only when it keeps at least 3 rows', () => {
		expect(rangeQuickPicks(LADDER, [50, 50, 50, 50, 500, 500, 500, 5000, 5000, 5000])).toEqual([100, 1000])
		expect(rangeQuickPicks(LADDER, [50, 50, 500, 500])).toEqual([])
	})

	test('drops a step that would hide less than a tenth of the rows', () => {
		const values = [...Array.from({ length: 19 }, () => 500), 50]
		expect(rangeQuickPicks(LADDER, values)).toEqual([])
		expect(rangeQuickPicks(LADDER, [...values, 50, 50])).toEqual([100])
	})

	test('counts rows without a value as hidden, since every bound drops them', () => {
		expect(rangeQuickPicks(LADDER, [500, 500, 500])).toEqual([])
		expect(rangeQuickPicks(LADDER, [500, 500, 500, null])).toEqual([100])
	})

	test('keeps every row when no bound is set and drops missing values once one is', () => {
		expect(inRange(null, null, null)).toBe(true)
		expect(inRange(null, 0, null)).toBe(false)
		expect(inRange(0, 0, 0)).toBe(true)
		expect(inRange(5, 1, 4)).toBe(false)
	})
})

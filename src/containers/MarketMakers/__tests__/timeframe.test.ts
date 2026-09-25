import { describe, expect, test } from 'vitest'
import { isDefaultRange, timeframeToRange } from '../timeframe'

const today = new Date(Date.UTC(2026, 5, 29))

describe('isDefaultRange', () => {
	test('is true for the default 30-day range', () => {
		expect(isDefaultRange(timeframeToRange('Prev. 30d', new Date()))).toBe(true)
	})
	test('is false for a 7-day range', () => {
		expect(isDefaultRange(timeframeToRange('Prev. 7d', new Date()))).toBe(false)
	})
	test('is false for the empty All Time range', () => {
		expect(isDefaultRange({})).toBe(false)
	})
})

describe('timeframeToRange', () => {
	test('returns no bounds for All Time', () => {
		expect(timeframeToRange('All Time', today)).toEqual({})
	})
	test('returns a start 30 days back and end today for Prev. 30d', () => {
		expect(timeframeToRange('Prev. 30d', today)).toEqual({ start_date: '2026-05-30', end_date: '2026-06-29' })
	})
	test('returns a 7-day window for Prev. 7d', () => {
		expect(timeframeToRange('Prev. 7d', today)).toEqual({ start_date: '2026-06-22', end_date: '2026-06-29' })
	})
})

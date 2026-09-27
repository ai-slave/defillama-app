import { describe, expect, test } from 'vitest'
import { timeframeToRange } from '../timeframe'

const today = new Date(Date.UTC(2026, 5, 29))

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

import { describe, expect, it } from 'vitest'
import { isDefaultRange, timeframeBadge, timeframeToRange } from '../timeframe'

const today = new Date(Date.UTC(2026, 5, 29))

describe('isDefaultRange', () => {
	it('is true for the default 30-day range', () => {
		expect(isDefaultRange(timeframeToRange('Prev. 30d', new Date()))).toBe(true)
	})
	it('is false for a 7-day range', () => {
		expect(isDefaultRange(timeframeToRange('Prev. 7d', new Date()))).toBe(false)
	})
	it('is false for the empty All Time range', () => {
		expect(isDefaultRange({})).toBe(false)
	})
})

describe('timeframeToRange', () => {
	it('returns no bounds for All Time', () => {
		expect(timeframeToRange('All Time', today)).toEqual({})
	})
	it('returns a start 30 days back and end today for Prev. 30d', () => {
		expect(timeframeToRange('Prev. 30d', today)).toEqual({ start_date: '2026-05-30', end_date: '2026-06-29' })
	})
	it('returns a 7-day window for Prev. 7d', () => {
		expect(timeframeToRange('Prev. 7d', today)).toEqual({ start_date: '2026-06-22', end_date: '2026-06-29' })
	})
})

describe('timeframeBadge', () => {
	it('maps Prev. 7d to Last 7-day', () => {
		expect(timeframeBadge('Prev. 7d')).toBe('Last 7-day')
	})
	it('maps Prev. 30d to Last 30-day', () => {
		expect(timeframeBadge('Prev. 30d')).toBe('Last 30-day')
	})
	it('maps Prev. 60d to Last 60-day', () => {
		expect(timeframeBadge('Prev. 60d')).toBe('Last 60-day')
	})
	it('passes All Time through unchanged', () => {
		expect(timeframeBadge('All Time')).toBe('All Time')
	})
})

import { describe, expect, test } from 'vitest'
import { formatDate, formatDateTime, formatIsoDate, formatMonthYear, formatRelativeTime } from './dateFormat'

describe('date formatters', () => {
	test('formats calendar facts in UTC from each supported input', () => {
		expect(formatDate('2026-07-24')).toBe('Jul 24, 2026')
		expect(formatDate('2026-07-24T00:30:00+14:00')).toBe('Jul 23, 2026')
		expect(formatDate(Date.UTC(2026, 6, 24), { input: 'milliseconds' })).toBe('Jul 24, 2026')
		expect(formatDate(Date.UTC(2026, 6, 24) / 1000, { input: 'seconds' })).toBe('Jul 24, 2026')
		expect(formatDate(new Date('2024-02-29T23:59:00Z'))).toBe('Feb 29, 2024')
	})

	test('retains the time for exact instants and labels UTC output', () => {
		expect(formatDateTime('2026-07-24T16:30:00Z', { timeZone: 'UTC' })).toBe('Jul 24, 2026, 4:30 PM UTC')
		expect(formatDateTime(Date.UTC(2026, 6, 24, 16, 30), { input: 'milliseconds', timeZone: 'UTC' })).toBe(
			'Jul 24, 2026, 4:30 PM UTC'
		)
		const local = formatDateTime('2026-07-24T16:30:00Z', { timeZone: 'local' })
		const localWithZone = formatDateTime('2026-07-24T16:30:00Z', { timeZone: 'local', timeZoneName: 'short' })
		expect(localWithZone).not.toBe(local)
	})

	test('rejects invalid and timezone-ambiguous values', () => {
		expect(formatDate('2026-02-30')).toBeNull()
		expect(formatDate('not-a-date')).toBeNull()
		expect(formatDateTime('2026-02-30T12:00:00Z', { timeZone: 'UTC' })).toBeNull()
		expect(formatDateTime('2026-07-24T24:00:00Z', { timeZone: 'UTC' })).toBeNull()
		expect(formatDateTime('2026-07-24T12:00:00+14:30', { timeZone: 'UTC' })).toBeNull()
		expect(formatDateTime('2026-07-24', { timeZone: 'UTC' })).toBeNull()
		expect(formatDateTime('2026-07-24T16:30:00', { timeZone: 'local' })).toBeNull()
		expect(formatRelativeTime('2026-07-24T16:30:00')).toBeNull()
		expect(formatDate(new Date(Number.NaN))).toBeNull()
		expect(formatRelativeTime('2026-07-24T16:30:00Z', { now: new Date(Number.NaN) })).toBeNull()
	})

	test('keeps UTC date-time punctuation and 12-hour boundaries stable across runtimes', () => {
		for (const [value, expected] of [
			['2026-07-24T00:05:00Z', 'Jul 24, 2026, 12:05 AM UTC'],
			['2026-07-24T12:00:00Z', 'Jul 24, 2026, 12:00 PM UTC'],
			['2026-07-24T23:59:00Z', 'Jul 24, 2026, 11:59 PM UTC'],
			['2026-07-24T00:30:00+14:00', 'Jul 23, 2026, 10:30 AM UTC']
		]) {
			expect(formatDateTime(value, { timeZone: 'UTC' })).toBe(expected)
		}
	})

	test('formats months and machine dates in UTC', () => {
		// Instants on both sides of UTC midnight fail a local-time formatter in both western and eastern zones.
		expect(formatMonthYear('2026-07-01T00:30:00Z')).toBe('Jul 2026')
		expect(formatMonthYear('2026-07-31T23:30:00Z')).toBe('Jul 2026')
		expect(formatIsoDate('2026-07-24T00:30:00Z')).toBe('2026-07-24')
		expect(formatIsoDate('2026-07-23T23:30:00Z')).toBe('2026-07-23')
	})

	test('formats recent instants relative to a supplied clock and older instants as dates', () => {
		const now = new Date('2026-07-24T12:00:00Z')

		expect(formatRelativeTime('2026-07-24T11:59:58Z', { now })).toBe('just now')
		expect(formatRelativeTime('2026-07-24T11:59:30Z', { now })).toBe('30s ago')
		expect(formatRelativeTime('2026-07-24T09:00:00Z', { now })).toBe('3h ago')
		expect(formatRelativeTime('2026-07-26T12:00:00Z', { now })).toBe('in 2d')
		expect(formatRelativeTime('2026-07-17T12:00:00Z', { now })).toBe('Jul 17, 2026')
	})

	test('uses elapsed time at relative boundaries', () => {
		const now = new Date('2026-03-08T12:00:00Z')

		expect(formatRelativeTime('2026-03-08T11:59:55.001Z', { now })).toBe('just now')
		expect(formatRelativeTime('2026-03-08T11:59:55.000Z', { now })).toBe('5s ago')
		expect(formatRelativeTime('2026-03-08T11:59:00.001Z', { now })).toBe('59s ago')
		expect(formatRelativeTime('2026-03-08T11:59:00.000Z', { now })).toBe('1min ago')
		expect(formatRelativeTime('2026-03-07T12:00:00Z', { now })).toBe('1d ago')
	})
})

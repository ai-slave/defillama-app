import { afterEach, describe, expect, test, vi } from 'vitest'
import { formatIsoDate } from '~/utils/dateFormat'
import { filterCsvByDateRange, resolveDateRange } from '../csvDateFilter'

afterEach(() => {
	vi.useRealTimers()
})

describe('CSV date filters', () => {
	test('normalizes only valid calendar dates and offset-bearing instants', () => {
		expect(formatIsoDate('2026-07-24')).toBe('2026-07-24')
		expect(formatIsoDate('2026-07-24T16:00:00Z')).toBe('2026-07-24')
		expect(formatIsoDate('2026-07-24T00:30:00+14:00')).toBe('2026-07-23')
		expect(formatIsoDate('2026-07-24T23:30:00-02:00')).toBe('2026-07-25')
		expect(formatIsoDate('2026-02-30T16:00:00Z')).toBeNull()
		expect(formatIsoDate('2026-07-24garbage')).toBeNull()
	})

	test('resolves Last N days to exactly N inclusive calendar dates', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 6, 24, 12))

		expect(resolveDateRange({ kind: 'preset', preset: '7d' })).toEqual({ from: '2026-07-18', to: '2026-07-24' })
		expect(resolveDateRange({ kind: 'preset', preset: '30d' })).toEqual({ from: '2026-06-25', to: '2026-07-24' })
		expect(resolveDateRange({ kind: 'preset', preset: '90d' })).toEqual({ from: '2026-04-26', to: '2026-07-24' })
	})

	test('keeps both inclusive endpoints when filtering CSV rows', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 6, 24, 12))
		const csv = ['date,value', '2026-07-17,1', '2026-07-18,2', '2026-07-24T16:00:00Z,3', '2026-07-25,4'].join('\n')

		expect(filterCsvByDateRange(csv, { kind: 'preset', preset: '7d' })).toBe(
			['date,value', '2026-07-18,2', '2026-07-24T16:00:00Z,3'].join('\n')
		)
	})
})

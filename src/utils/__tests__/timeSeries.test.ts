import { describe, expect, test } from 'vitest'
import {
	findTimeSeriesPointNear,
	getCompleteTimeSeriesDailyWindow,
	getTimeSeriesPeriodPair,
	toUnixMsTimestamp
} from '../timeSeries'

const NOW = Date.parse('2026-07-14T12:00:00Z')
const day = (isoDate: string, value: number) => ({ date: `${isoDate}T00:00:00Z`, value })

describe('time-series freshness helpers', () => {
	test('normalizes seconds, milliseconds, numeric strings, and ISO timestamps', () => {
		expect(toUnixMsTimestamp(1_783_987_200)).toBe(NOW - 12 * 60 * 60 * 1000)
		expect(toUnixMsTimestamp(1_783_987_200_000)).toBe(NOW - 12 * 60 * 60 * 1000)
		expect(toUnixMsTimestamp('1783987200')).toBe(NOW - 12 * 60 * 60 * 1000)
		expect(toUnixMsTimestamp('2026-07-14T00:00:00Z')).toBe(NOW - 12 * 60 * 60 * 1000)
	})

	test('accepts a comparison point within two hours of the exact target', () => {
		const series = [{ date: '2026-06-14T01:30:00Z', value: 80 }, day('2026-07-14', 100)]
		expect(getTimeSeriesPeriodPair(series, 30, (point) => point.date, { currentTimeMs: NOW })).toEqual({
			current: series[1],
			previous: series[0]
		})
	})

	test('does not substitute day 29 or day 31 for a missing 30-day point', () => {
		const series = [day('2026-06-13', 70), day('2026-06-15', 80), day('2026-07-14', 100)]
		expect(getTimeSeriesPeriodPair(series, 30, (point) => point.date, { currentTimeMs: NOW })).toBeNull()
	})

	test('allows sparse intermediate history for endpoint-to-endpoint changes', () => {
		const series = [day('2026-06-14', 80), day('2026-07-01', 90), day('2026-07-14', 100)]
		expect(getTimeSeriesPeriodPair(series, 30, (point) => point.date, { currentTimeMs: NOW })?.previous.value).toBe(80)
	})

	test('rejects a stale current endpoint', () => {
		const series = [day('2026-06-13', 80), day('2026-07-13', 100)]
		expect(getTimeSeriesPeriodPair(series, 30, (point) => point.date, { currentTimeMs: NOW })).toBeNull()
	})

	test('requires every expected bucket for rolling daily totals', () => {
		const complete = [day('2026-07-11', 1), day('2026-07-12', 2), day('2026-07-13', 3)]
		const missingMiddle = [day('2026-07-11', 1), day('2026-07-13', 3)]

		expect(
			getCompleteTimeSeriesDailyWindow(complete, 3, (point) => point.date, {
				currentTimeMs: NOW,
				currentDayOffset: 1
			})?.map((point) => point.value)
		).toEqual([3, 2, 1])
		expect(
			getCompleteTimeSeriesDailyWindow(missingMiddle, 3, (point) => point.date, {
				currentTimeMs: NOW,
				currentDayOffset: 1
			})
		).toBeNull()
	})

	test('prefers the later point when two timestamps are equally close', () => {
		const series = [day('2026-07-13', 1), day('2026-07-15', 2)]
		expect(
			findTimeSeriesPointNear(series, Date.parse('2026-07-14T00:00:00Z'), (point) => point.date, 24 * 60 * 60 * 1000)
		).toEqual(series[1])
	})
})

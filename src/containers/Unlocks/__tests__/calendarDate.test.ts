import { afterEach, expect, test } from 'vitest'
import { calendarDateFromQuery } from '../calendarUtils'

const originalTimeZone = process.env.TZ
// 00:30 UTC on October 1st is still September 30th in Los Angeles.
const NOW_SEC = Date.UTC(2026, 9, 1, 0, 30) / 1000

afterEach(() => {
	if (originalTimeZone === undefined) delete process.env.TZ
	else process.env.TZ = originalTimeZone
})

test('without a date query the calendar opens on the UTC day in every zone', () => {
	process.env.TZ = 'UTC'
	expect(calendarDateFromQuery(undefined, NOW_SEC).format('YYYY-MM-DD')).toBe('2026-10-01')
	process.env.TZ = 'America/Los_Angeles'
	expect(calendarDateFromQuery(undefined, NOW_SEC).format('YYYY-MM-DD')).toBe('2026-10-01')
})

test('a date query opens that day, and an unparseable one falls back to the UTC day', () => {
	process.env.TZ = 'America/Los_Angeles'
	expect(calendarDateFromQuery('2026-03-15', NOW_SEC).format('YYYY-MM-DD')).toBe('2026-03-15')
	expect(calendarDateFromQuery('not-a-date', NOW_SEC).format('YYYY-MM-DD')).toBe('2026-10-01')
})

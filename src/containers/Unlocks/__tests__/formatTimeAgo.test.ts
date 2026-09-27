import { afterEach, describe, expect, test } from 'vitest'
import { formatTimeAgo } from '../UpcomingEvent'

const event = Date.UTC(2026, 2, 7, 12) / 1e3
// 23.5 hours later, across the US daylight-saving switch on 2026-03-08.
const seed = Date.UTC(2026, 2, 8, 11, 30) / 1e3

const originalTz = process.env.TZ

afterEach(() => {
	process.env.TZ = originalTz
})

describe('formatTimeAgo', () => {
	test('reads the same label in every time zone', () => {
		process.env.TZ = 'UTC'
		expect(formatTimeAgo(event, seed)).toBe('23H ago')
		process.env.TZ = 'America/New_York'
		expect(formatTimeAgo(event, seed)).toBe('23H ago')
	})

	test('counts whole days, months and years from the seed', () => {
		process.env.TZ = 'UTC'
		expect(formatTimeAgo(event, event + 3 * 86_400)).toBe('3D ago')
		expect(formatTimeAgo(event, Date.UTC(2026, 4, 9, 12) / 1e3)).toBe('2M 2D ago')
		expect(formatTimeAgo(event, Date.UTC(2027, 2, 7, 12) / 1e3)).toBe('1Y ago')
		expect(formatTimeAgo(event, event + 60)).toBe('just now')
	})
})

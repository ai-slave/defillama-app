import { describe, expect, test } from 'vitest'
import { isVerifiedCurrent, verifiedAgeDays } from './verifiedFreshness'

const NOON = Date.parse('2026-09-03T12:00:00Z')

describe('verified freshness', () => {
	test('counts whole UTC days, so the hour the probe ran cannot move the answer', () => {
		expect(verifiedAgeDays('2026-09-03T00:00:00.000Z', NOON)).toBe(0)
		expect(verifiedAgeDays('2026-09-02T23:59:59Z', NOON)).toBe(1)
		expect(verifiedAgeDays('2026-09-01', NOON)).toBe(2)
		expect(verifiedAgeDays(null, NOON)).toBeNull()
		expect(verifiedAgeDays('not a date', NOON)).toBeNull()
	})

	test('tolerates one missed day and no more', () => {
		expect(isVerifiedCurrent('2026-09-03T00:00:00.000Z', NOON)).toBe(true)
		expect(isVerifiedCurrent('2026-09-02T00:00:00.000Z', NOON)).toBe(true)
		expect(isVerifiedCurrent('2026-09-01T00:00:00.000Z', NOON)).toBe(false)
		expect(isVerifiedCurrent('2026-08-28T00:00:00.000Z', NOON)).toBe(false)
		expect(isVerifiedCurrent(null, NOON)).toBe(false)
	})
})

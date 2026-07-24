import { describe, expect, it } from 'vitest'
import { formatUnlockDate, formatUnlockTime } from './dateFormat'

describe('unlock date labels', () => {
	it('preserves the legacy UTC date and 24-hour time shape', () => {
		const timestamp = Date.UTC(2026, 6, 4, 0, 5) / 1_000
		expect(formatUnlockDate(timestamp)).toBe('04 Jul 2026')
		expect(formatUnlockTime(timestamp)).toBe('00:05')
		expect(formatUnlockDate(Date.UTC(2026, 8, 4) / 1_000)).toBe('04 Sep 2026')
	})
})

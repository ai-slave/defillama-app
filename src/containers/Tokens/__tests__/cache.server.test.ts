import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTokensCacheControl } from '../cache.server'

afterEach(() => {
	vi.useRealTimers()
})

describe('tokens edge cache alignment', () => {
	it('expires every token response at the same five-minute boundary without serving stale data', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-15T10:02:30.000Z'))

		expect(getTokensCacheControl(Date.now())).toBe('public, s-maxage=150, must-revalidate')
		expect(getTokensCacheControl(Date.now())).not.toContain('stale-while-revalidate')
	})

	it('does not cache a snapshot built in an earlier boundary window into the current one', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-15T10:04:59.000Z'))
		const previousWindowBuild = Date.now()

		vi.setSystemTime(new Date('2026-07-15T10:05:00.000Z'))

		expect(getTokensCacheControl(previousWindowBuild)).toBe('private, no-store')
		expect(getTokensCacheControl(Date.now())).toBe('public, s-maxage=300, must-revalidate')
	})
})

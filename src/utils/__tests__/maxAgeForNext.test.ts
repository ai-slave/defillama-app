import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	cacheJitterOffsetSeconds,
	jitterCacheControlHeader,
	jitterCacheSeconds,
	jitterStaticPropsCacheSeconds,
	maxAgeForNext,
	readCacheJitterMeta,
	attachCacheJitterMeta
} from '../maxAgeForNext'

describe('cache lifetime jitter', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.useRealTimers()
	})

	test('returns a deterministic centered offset', () => {
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')

		const first = cacheJitterOffsetSeconds('protocol/uniswap', 1200)
		const second = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		expect(first).toBe(second)
		expect(first).toBeGreaterThanOrEqual(-600)
		expect(first).toBeLessThanOrEqual(600)
	})

	test('does not jitter an unkeyed cache entry', () => {
		expect(cacheJitterOffsetSeconds('', 1200)).toBe(0)
		expect(jitterStaticPropsCacheSeconds(300, '')).toEqual({ seconds: 300, offsetSeconds: 0 })
	})

	test('changes the deterministic offset across build ids', () => {
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')
		const first = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		vi.stubEnv('NEXT_BUILD_ID', 'build-b')
		const second = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		expect(first).not.toBe(second)
	})

	test('uses the Coolify source commit when no Next build id is set', () => {
		vi.stubEnv('SOURCE_COMMIT', 'commit-a')
		const first = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		vi.stubEnv('SOURCE_COMMIT', 'commit-b')
		const second = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		expect(first).not.toBe(second)
	})

	test('skips blank build id env vars when selecting the jitter seed', () => {
		vi.stubEnv('BUILD_ID', 'commit-a')
		vi.stubEnv('SOURCE_COMMIT', '')
		const first = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		vi.stubEnv('BUILD_ID', 'commit-b')
		const second = cacheJitterOffsetSeconds('protocol/uniswap', 1200)

		expect(first).not.toBe(second)
	})

	test('can be disabled without changing the base cache lifetime', () => {
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')

		expect(jitterCacheSeconds(30, 'short-cache')).toEqual({ seconds: 30, offsetSeconds: 0 })
		expect(jitterStaticPropsCacheSeconds(30, 'static-page')).toEqual({ seconds: 30, offsetSeconds: 0 })
		expect(jitterCacheControlHeader('public, s-maxage=300, stale-while-revalidate=600', 'route')).toBe(
			'public, s-maxage=300, stale-while-revalidate=600'
		)
	})

	test('jitters s-maxage while preserving the rest of the Cache-Control header', () => {
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')

		const header = jitterCacheControlHeader('public, max-age=60, s-maxage=300, stale-while-revalidate=300', 'markets')
		const match = header.match(/s-maxage=(\d+)/)
		const sMaxage = Number(match?.[1])

		expect(header).toContain('public, max-age=60')
		expect(header).toContain('stale-while-revalidate=300')
		expect(sMaxage).not.toBeNaN()
		expect(sMaxage).toBeGreaterThanOrEqual(60)
		expect(sMaxage).toBeLessThanOrEqual(1500)
	})

	test('keeps short static-page intervals close to their intended duration', () => {
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')

		const jittered = jitterStaticPropsCacheSeconds(300, 'etfs')
		expect(jittered.seconds).toBeGreaterThanOrEqual(300)
		expect(jittered.seconds).toBeLessThanOrEqual(420)
	})

	test('schedules every hourly static route once after the data-ready boundary', () => {
		vi.useFakeTimers()
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')
		const firstBoundary = new Date(2026, 0, 1, 1, 22, 0)

		for (let route = 0; route < 1000; route++) {
			vi.setSystemTime(new Date(2026, 0, 1, 0, 22, 0))

			for (let hour = 0; hour < 24; hour++) {
				const baseSeconds = maxAgeForNext([22])
				const { seconds } = jitterStaticPropsCacheSeconds(baseSeconds, `route-${route}`)
				vi.advanceTimersByTime(seconds * 1000)

				const expectedBoundary = new Date(firstBoundary.getTime() + hour * 60 * 60 * 1000)
				const regeneratedAt = Date.now()
				expect(regeneratedAt).toBeGreaterThanOrEqual(expectedBoundary.getTime())
				expect(regeneratedAt).toBeLessThanOrEqual(expectedBoundary.getTime() + 20 * 60 * 1000)
			}
		}
	})

	test('stores jitter metadata without making it enumerable', () => {
		const target = attachCacheJitterMeta({ revalidate: 123 }, { cache_jitter_seconds: -12 })

		expect(readCacheJitterMeta(target)).toEqual({ cache_jitter_seconds: -12 })
		expect(Object.keys(target)).toEqual(['revalidate'])
	})
})

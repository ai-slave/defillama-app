import type { GetStaticPropsContext } from 'next'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readCacheJitterMeta } from '../maxAgeForNext'

describe('withPerformanceLogging', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.resetModules()
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	test('jitters numeric getStaticProps revalidate values on props results', async () => {
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')
		const { withPerformanceLogging } = await import('../perf')

		const wrapped = withPerformanceLogging('protocol/[protocol]', async () => ({
			props: { ok: true },
			revalidate: 3600
		}))
		const context = { params: { protocol: 'uniswap' } } satisfies GetStaticPropsContext
		const result = await wrapped(context)

		// Each resolved path gets its own offset, so pages of one route do not regenerate together.
		expect(result).toMatchObject({ props: { ok: true }, revalidate: 4769 })
		expect(readCacheJitterMeta(result)).toEqual({ cache_jitter_seconds: 1169 })
	})

	test('jitters numeric getStaticProps revalidate values on notFound results', async () => {
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')
		const { withPerformanceLogging } = await import('../perf')

		const wrapped = withPerformanceLogging('protocol/[protocol]', async () => ({
			notFound: true,
			revalidate: 3600
		}))
		const context = { params: { protocol: 'missing' } } satisfies GetStaticPropsContext
		const result = await wrapped(context)

		expect(result).toEqual({ notFound: true, revalidate: 3619 })
		expect(readCacheJitterMeta(result)).toEqual({ cache_jitter_seconds: 19 })
	})

	test('can skip numeric getStaticProps revalidate jitter', async () => {
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		vi.stubEnv('NEXT_BUILD_ID', 'build-a')
		const { withPerformanceLogging } = await import('../perf')

		const wrapped = withPerformanceLogging(
			'index',
			async () => ({
				props: { ok: true },
				revalidate: 60
			}),
			{ jitterRevalidate: false }
		)
		const result = await wrapped({ params: {} } satisfies GetStaticPropsContext)

		expect(result).toEqual({ props: { ok: true }, revalidate: 60 })
		expect(readCacheJitterMeta(result)).toBeUndefined()
	})

	test('records Next revalidation reasons on static route telemetry', async () => {
		vi.stubEnv('OPS_TELEMETRY_URL', 'test-ingest-url')
		vi.stubEnv('OPS_TELEMETRY_TOKEN', 'secret')
		vi.stubEnv('OPS_TELEMETRY_BATCH_SIZE', '100')
		vi.stubEnv('OPS_TELEMETRY_QUEUE_MAX', '100')
		vi.stubEnv('OPS_TELEMETRY_SEND_TIMEOUT_MS', '100')
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }))
		vi.stubGlobal('fetch', fetchMock)
		const { withPerformanceLogging } = await import('../perf')
		const { telemetryTest } = await import('../telemetry')

		try {
			const wrapped = withPerformanceLogging(
				'index',
				async () => ({
					props: { ok: true },
					revalidate: 60
				}),
				{ jitterRevalidate: false }
			)

			await wrapped({ params: {}, revalidateReason: 'stale' } satisfies GetStaticPropsContext)

			const events = fetchMock.mock.calls
				.filter(([url]) => url === process.env.OPS_TELEMETRY_URL)
				.flatMap(([, init]) => JSON.parse(String((init as RequestInit).body)).events)
			const tick = events.find((event) => event.type === 'page_build_finish_tick')
			expect(tick?.attributes).toMatchObject({
				revalidate_reason: 'stale',
				telemetry_target_id: 'defillama'
			})
		} finally {
			telemetryTest.reset()
		}
	})

	test('stops retrying transient page build failures once the cumulative budget is exceeded', async () => {
		vi.stubEnv('PAGE_BUILD_MAX_RETRIES', '3')
		vi.stubEnv('PAGE_BUILD_RETRY_BUDGET_MS', '1')
		const { withPerformanceLogging } = await import('../perf')
		let calls = 0

		const wrapped = withPerformanceLogging('slow-route', async () => {
			calls++
			await new Promise((resolve) => setTimeout(resolve, 5))
			throw new Error('timeout from upstream')
		})

		const context = { params: {} } satisfies GetStaticPropsContext
		await expect(wrapped(context)).rejects.toThrow('timeout from upstream')
		expect(calls).toBe(1)
	})

	test('records route phase timings as route telemetry attributes', async () => {
		vi.stubEnv('OPS_TELEMETRY_URL', 'test-ingest-url')
		vi.stubEnv('OPS_TELEMETRY_TOKEN', 'secret')
		vi.stubEnv('OPS_TELEMETRY_BATCH_SIZE', '100')
		vi.stubEnv('OPS_TELEMETRY_QUEUE_MAX', '100')
		vi.stubEnv('OPS_TELEMETRY_SEND_TIMEOUT_MS', '100')
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }))
		vi.stubGlobal('fetch', fetchMock)
		const { createRoutePhaseTimer } = await import('../perf')
		const { telemetryTest, withStaticRouteTelemetry } = await import('../telemetry')
		const { addApiRoutePhase } = await import('../../server/api/phaseTelemetry')

		try {
			await withStaticRouteTelemetry('phase-route', async () => {
				const timer = createRoutePhaseTimer()
				const stopTotal = timer.start('total')
				await timer.time('async_phase', async () => 'ok')
				addApiRoutePhase('shared_helper_phase', 12)
				addApiRoutePhase('bad_helper_phase', Number.NaN)
				stopTotal()
				timer.record()
				return { props: { ok: true } }
			})

			const events = fetchMock.mock.calls
				.filter(([url]) => url === process.env.OPS_TELEMETRY_URL)
				.flatMap(([, init]) => JSON.parse(String((init as RequestInit).body)).events)
			const route = events.find((event) => event.type === 'route_execution' && event.route === 'phase-route')
			expect(route?.attributes?.route_phases_ms).toMatchObject({
				async_phase: expect.any(Number),
				shared_helper_phase: 12,
				total: expect.any(Number)
			})
			expect(route?.attributes?.route_phases_ms?.bad_helper_phase).toBeUndefined()
		} finally {
			telemetryTest.reset()
		}
	})
})

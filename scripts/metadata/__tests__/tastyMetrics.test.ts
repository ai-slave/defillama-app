import { describe, expect, test, vi } from 'vitest'
import { fetchTastyMetrics } from '../tastyMetrics'

describe('fetchTastyMetrics', () => {
	test('gives up on a stalled Tasty request after 15 seconds', async () => {
		vi.useFakeTimers()
		const requestedUrls: Array<string> = []
		const fetchFn = (url: RequestInfo | URL, init?: RequestInit) => {
			requestedUrls.push(String(url))
			return new Promise<Response>((_, reject) =>
				init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
			)
		}
		let settled = false

		const result = fetchTastyMetrics({
			endAt: 2,
			env: { TASTY_API_URL: 'https://tasty.test' },
			fetchFn,
			logger: { log: vi.fn() },
			startAt: 1
		}).finally(() => {
			settled = true
		})
		await vi.advanceTimersByTimeAsync(15_000)
		vi.useRealTimers()

		expect(settled).toBe(true)
		expect(await result).toEqual({ tastyMetrics: {}, trendingRoutes: [] })
		expect(requestedUrls).toEqual(['https://tasty.test/metrics?startAt=1&endAt=2&unit=day&type=url'])
	})

	test('returns empty metrics when the Tasty response is not ok', async () => {
		const result = await fetchTastyMetrics({
			endAt: 2,
			env: { TASTY_API_URL: 'https://tasty.test' },
			fetchFn: vi.fn().mockResolvedValue(new Response('not authorized', { status: 401 })),
			logger: { log: vi.fn() },
			startAt: 1
		})

		expect(result).toEqual({ tastyMetrics: {}, trendingRoutes: [] })
	})

	test('returns empty metrics when the Tasty request fails', async () => {
		const result = await fetchTastyMetrics({
			endAt: 2,
			env: { TASTY_API_URL: 'https://tasty.test' },
			fetchFn: vi.fn().mockRejectedValue(new Error('network failed')),
			logger: { log: vi.fn() },
			startAt: 1
		})

		expect(result).toEqual({ tastyMetrics: {}, trendingRoutes: [] })
	})
})

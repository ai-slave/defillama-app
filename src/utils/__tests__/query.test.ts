import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mergeFailedReads, queryReadFailed, queryRefreshFailed } from '../query'

describe('queryReadFailed', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	test('keeps a failure with no data through its retry and clears it when an attempt succeeds', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		let attempt = 0
		let finishRetry = (_value: string) => {}
		const observer = new QueryObserver(client, {
			queryKey: ['read'],
			queryFn: () => {
				attempt += 1
				if (attempt === 1) return Promise.reject(new Error('down'))
				return new Promise<string>((resolve) => {
					finishRetry = resolve
				})
			}
		})
		const unsubscribe = observer.subscribe(() => {})
		await expect.poll(() => observer.getCurrentResult().status).toBe('error')
		expect(queryReadFailed(observer.getCurrentResult())).toBe(true)

		const retry = observer.refetch()
		const retrying = observer.getCurrentResult()
		expect([retrying.isError, retrying.isFetching, queryReadFailed(retrying)]).toEqual([false, true, true])

		finishRetry('ok')
		await retry
		expect(queryReadFailed(observer.getCurrentResult())).toBe(false)
		unsubscribe()
		client.clear()
	})

	test('a failed refresh keeps the loaded data: a refresh failure, not a read failure', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		let fail = false
		const observer = new QueryObserver(client, {
			queryKey: ['refresh'],
			queryFn: () => (fail ? Promise.reject(new Error('down')) : Promise.resolve('loaded'))
		})
		const unsubscribe = observer.subscribe(() => {})
		await expect.poll(() => observer.getCurrentResult().data).toBe('loaded')
		expect(queryReadFailed(observer.getCurrentResult())).toBe(false)

		// The refresh fails a second after the load, as real attempts take time.
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(Date.now() + 1000)
		fail = true
		await observer.refetch()
		const refreshed = observer.getCurrentResult()
		expect([refreshed.data, queryReadFailed(refreshed), queryRefreshFailed(refreshed)]).toEqual(['loaded', false, true])

		fail = false
		vi.setSystemTime(Date.now() + 1000)
		await observer.refetch()
		expect(queryRefreshFailed(observer.getCurrentResult())).toBe(false)
		unsubscribe()
		client.clear()
	})

	test('a placeholder shown during the retry is nothing to show, so the read failure stays', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		let attempt = 0
		const observer = new QueryObserver(client, {
			queryKey: ['page', 2],
			queryFn: () => {
				attempt += 1
				return attempt === 1 ? Promise.reject(new Error('down')) : new Promise<string>(() => {})
			},
			placeholderData: 'page 1'
		})
		const unsubscribe = observer.subscribe(() => {})
		await expect.poll(() => observer.getCurrentResult().status).toBe('error')

		void observer.refetch()
		const retrying = observer.getCurrentResult()
		expect([retrying.data, retrying.isPlaceholderData]).toEqual(['page 1', true])
		expect([queryReadFailed(retrying), queryRefreshFailed(retrying)]).toEqual([true, false])
		unsubscribe()
		client.clear()
	})
})

describe('mergeFailedReads', () => {
	test('reruns only the failed reads and waits while any of them runs', () => {
		const first = { refetch: vi.fn(), isFetching: false }
		const second = { refetch: vi.fn(), isFetching: true }
		const merged = mergeFailedReads([first, null, second])
		expect(merged?.isFetching).toBe(true)
		merged?.refetch()
		expect([first.refetch.mock.calls.length, second.refetch.mock.calls.length]).toEqual([1, 1])
	})

	test('is null when no read failed', () => {
		expect(mergeFailedReads([null, null])).toBeNull()
	})
})

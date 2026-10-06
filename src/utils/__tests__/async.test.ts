import { afterEach, describe, expect, test, vi } from 'vitest'
import { handleSimpleFetchResponse, httpErrorMessage, mapWithConcurrency } from '../async'

const jsonResponse = (value: unknown) =>
	new Response(JSON.stringify(value), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})

describe('mapWithConcurrency', () => {
	test('bounds active work and preserves input order', async () => {
		let active = 0
		let maxActive = 0
		const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
			active += 1
			maxActive = Math.max(maxActive, active)
			await Promise.resolve()
			active -= 1
			return value * 2
		})

		expect(maxActive).toBe(2)
		expect(results).toEqual([2, 4, 6, 8, 10])
	})
})

describe('fetchJson singleflight', () => {
	afterEach(() => {
		vi.useRealTimers()
		vi.resetModules()
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	test('shares concurrent safe public GET JSON requests when enabled', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		vi.stubEnv('SERVER_FETCH_JSON_TIMEOUT_MS', '1000')
		const fetchMock = vi.fn(
			() => new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse({ ok: true })), 10))
		)
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		const [first, second] = await Promise.all([
			fetchJson('https://api.llama.fi/test'),
			fetchJson('https://api.llama.fi/test')
		])

		expect(first).toEqual({ ok: true })
		expect(second).toEqual({ ok: true })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('does not singleflight unsafe requests', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		await Promise.all([
			fetchJson('https://api.llama.fi/test', { method: 'POST', body: '{}' }),
			fetchJson('https://api.llama.fi/test', { method: 'POST', body: '{}' }),
			fetchJson('https://api.llama.fi/test', { headers: { cookie: 'session=1' } }),
			fetchJson('https://api.llama.fi/test', { headers: { cookie: 'session=1' } })
		])

		expect(fetchMock).toHaveBeenCalledTimes(4)
	})

	test('bypasses sharing when the waiter cap is reached', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT_MAX_WAITERS', '0')
		const fetchMock = vi.fn(
			() => new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse({ ok: true })), 10))
		)
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		await Promise.all([fetchJson('https://api.llama.fi/test'), fetchJson('https://api.llama.fi/test')])

		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	test('times out followers without cancelling the leader request', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT_WAIT_MS', '5')
		vi.stubEnv('SERVER_FETCH_JSON_TIMEOUT_MS', '1000')
		const fetchMock = vi.fn(
			() => new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse({ ok: true })), 50))
		)
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		const leader = fetchJson('https://api.llama.fi/test')
		await expect(fetchJson('https://api.llama.fi/test')).rejects.toThrow('singleflight wait timeout')
		await expect(leader).resolves.toEqual({ ok: true })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('lets followers wait for the caller timeout by default', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		const fetchMock = vi.fn(
			() => new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse({ ok: true })), 30))
		)
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		const [first, second] = await Promise.all([
			fetchJson('https://api.llama.fi/slow-dataset', { timeout: 50 }),
			fetchJson('https://api.llama.fi/slow-dataset', { timeout: 50 })
		])

		expect(first).toEqual({ ok: true })
		expect(second).toEqual({ ok: true })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('does not share requests with different timeout budgets', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		await Promise.all([
			fetchJson('https://api.llama.fi/timeout-scoped', { timeout: 10_000 }),
			fetchJson('https://api.llama.fi/timeout-scoped', { timeout: 45_000 })
		])

		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	test('does not singleflight Request inputs', async () => {
		vi.stubEnv('SERVER_FETCH_JSON_SINGLEFLIGHT', '1')
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		await Promise.all([
			fetchJson(new Request('https://api.llama.fi/test')),
			fetchJson(new Request('https://api.llama.fi/test'))
		])

		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	test('does not retry non-retryable 4xx responses', async () => {
		const fetchMock = vi.fn(async () => new Response('missing', { status: 404 }))
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		await expect(fetchJson('https://api.llama.fi/missing')).rejects.toThrow('/missing: [404] missing')
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('keeps the 60s default timeout for browser fetchJson calls', async () => {
		vi.useFakeTimers()
		vi.stubGlobal('window', {})
		let firstSignal: AbortSignal | undefined
		const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
			if (fetchMock.mock.calls.length > 1) return Promise.resolve(jsonResponse({ ok: true }))

			firstSignal = init?.signal ?? undefined
			return new Promise<Response>((_resolve, reject) => {
				firstSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
			})
		})
		vi.stubGlobal('fetch', fetchMock)
		const { fetchJson } = await import('../async')

		const request = fetchJson('https://api.llama.fi/browser-timeout')
		await Promise.resolve()

		await vi.advanceTimersByTimeAsync(25_000)
		expect(firstSignal?.aborted).toBe(false)

		await vi.advanceTimersByTimeAsync(35_000)
		expect(firstSignal?.aborted).toBe(true)
		await vi.advanceTimersByTimeAsync(2000)

		await expect(request).resolves.toEqual({ ok: true })
		expect(fetchMock).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})
})

describe('httpErrorMessage', () => {
	const messageFor = (response: Response) =>
		handleSimpleFetchResponse(response).then(
			() => 'resolved',
			(error: unknown) => httpErrorMessage(error, 'Something went wrong')
		)

	test('shows the reason the server gave', async () => {
		expect(await messageFor(Response.json({ error: 'Seat limit reached' }, { status: 400 }))).toBe('Seat limit reached')
	})

	test('shows the status text of a failure without a body', async () => {
		expect(await messageFor(new Response(null, { status: 500, statusText: 'Internal Server Error' }))).toBe(
			'Internal Server Error'
		)
	})

	test('falls back for a failure with neither a body nor a status text', async () => {
		expect(await messageFor(new Response(null, { status: 503 }))).toBe('Something went wrong')
	})

	test('shows any other error as it is, and falls back for a value that is not an error', () => {
		expect(httpErrorMessage(new Error('Network down'), 'Something went wrong')).toBe('Network down')
		expect(httpErrorMessage('offline', 'Something went wrong')).toBe('Something went wrong')
	})
})

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { settleStopRequest } from '../stopSettlement'

const snapshot = { sessionId: 's1', revision: 3, queue: [] }
const running = { stopped: true, active: true }
const stopped = { stopped: true, active: false, snapshot }

/** Answers each stop poll in order; an Error entry is a network failure. */
function stopEndpoint(answers: Array<object | Error>) {
	return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
		const answer = answers.shift()
		if (!answer) throw new Error('unexpected stop poll')
		if (answer instanceof Error) throw answer
		return Response.json(answer)
	})
}

async function settle(
	authorizedFetch: typeof fetch,
	{
		signal = new AbortController().signal,
		isCurrentSession = () => true
	}: { signal?: AbortSignal; isCurrentSession?: () => boolean } = {}
) {
	const release = vi.fn()
	const applyQueueSnapshot = vi.fn()
	const promise = settleStopRequest({
		sessionId: 's1',
		signal,
		authorizedFetch,
		isCurrentSession,
		applyQueueSnapshot,
		release
	})
	// The retry backoff runs on fake timers, so every poll resolves without real waiting.
	await vi.runAllTimersAsync()
	return { outcome: await promise, release, applyQueueSnapshot }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('settling a stop request', () => {
	test('polls until the server reports the execution inactive, then applies its queue', async () => {
		const endpoint = stopEndpoint([running, stopped])
		const { outcome, release, applyQueueSnapshot } = await settle(endpoint)

		expect(outcome).toBe('stopped')
		expect(endpoint).toHaveBeenCalledTimes(2)
		expect(endpoint.mock.calls[0][0]).toBe('https://ai.llama.fi/agentic/stop/s1')
		expect(applyQueueSnapshot).toHaveBeenCalledWith(snapshot)
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('a first failure the server never acknowledged is reported to the reader', async () => {
		const { outcome, release } = await settle(stopEndpoint([new Error('offline')]))

		expect(outcome).toBe('failed')
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('a first failure after the reader left the session is not reported', async () => {
		let current = true
		const endpoint = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
			current = false
			throw new Error('offline')
		})
		const { outcome, release } = await settle(endpoint, { isCurrentSession: () => current })

		expect(outcome).toBe('abandoned')
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('a failure after an acknowledgement is retried rather than reported', async () => {
		const endpoint = stopEndpoint([running, new Error('flaky'), stopped])

		expect((await settle(endpoint)).outcome).toBe('stopped')
		expect(endpoint).toHaveBeenCalledTimes(3)
	})

	test('leaving the session abandons the settlement without polling', async () => {
		const endpoint = stopEndpoint([])
		const { outcome, release } = await settle(endpoint, { isCurrentSession: () => false })

		expect(outcome).toBe('abandoned')
		expect(endpoint).not.toHaveBeenCalled()
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('an aborted request abandons the settlement and still releases', async () => {
		const controller = new AbortController()
		const endpoint = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
			controller.abort()
			throw new Error('aborted')
		})
		const { outcome, release } = await settle(endpoint, { signal: controller.signal })

		expect(outcome).toBe('abandoned')
		expect(release).toHaveBeenCalledTimes(1)
	})
})

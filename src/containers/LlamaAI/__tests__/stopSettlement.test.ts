import { afterEach, describe, expect, test, vi } from 'vitest'

const { stopAgenticExecution } = vi.hoisted(() => ({ stopAgenticExecution: vi.fn() }))
vi.mock('~/containers/LlamaAI/fetchAgenticResponse', () => ({ stopAgenticExecution }))
vi.mock('~/containers/LlamaAI/executionCoordinator', () => ({
	waitForAbortableDelay: (_delay: number, signal: AbortSignal) =>
		signal.aborted ? Promise.reject(new DOMException('Aborted', 'AbortError')) : Promise.resolve()
}))

import { settleStopRequest } from '../stopSettlement'

function run(overrides: Partial<Parameters<typeof settleStopRequest>[0]> = {}) {
	const release = vi.fn()
	const applyQueueSnapshot = vi.fn()
	const promise = settleStopRequest({
		sessionId: 's1',
		signal: new AbortController().signal,
		authorizedFetch: vi.fn() as unknown as typeof fetch,
		isCurrentSession: () => true,
		applyQueueSnapshot,
		release,
		...overrides
	})
	return { promise, release, applyQueueSnapshot }
}

afterEach(() => vi.clearAllMocks())

describe('settling a stop request', () => {
	test('polls until the server reports the execution inactive', async () => {
		stopAgenticExecution
			.mockResolvedValueOnce({ stopped: true, active: true })
			.mockResolvedValueOnce({ stopped: true, active: false, snapshot: { rows: [] } })
		const { promise, release, applyQueueSnapshot } = run()

		await expect(promise).resolves.toBe('stopped')
		expect(stopAgenticExecution).toHaveBeenCalledTimes(2)
		expect(applyQueueSnapshot).toHaveBeenCalledWith({ rows: [] })
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('a first failure the server never acknowledged is reported to the reader', async () => {
		stopAgenticExecution.mockRejectedValue(new Error('offline'))
		const { promise, release } = run()

		await expect(promise).resolves.toBe('failed')
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('a failure after an acknowledgement is retried rather than reported', async () => {
		stopAgenticExecution
			.mockResolvedValueOnce({ stopped: true, active: true })
			.mockRejectedValueOnce(new Error('flaky'))
			.mockResolvedValueOnce({ stopped: true, active: false, snapshot: { rows: [] } })

		await expect(run().promise).resolves.toBe('stopped')
		expect(stopAgenticExecution).toHaveBeenCalledTimes(3)
	})

	test('leaving the session abandons the settlement without reporting anything', async () => {
		stopAgenticExecution.mockRejectedValue(new Error('offline'))
		const { promise, release } = run({ isCurrentSession: () => false })

		await expect(promise).resolves.toBe('abandoned')
		expect(stopAgenticExecution).not.toHaveBeenCalled()
		expect(release).toHaveBeenCalledTimes(1)
	})

	test('an aborted request abandons the settlement and still releases', async () => {
		const controller = new AbortController()
		stopAgenticExecution.mockImplementation(async () => {
			controller.abort()
			throw new Error('aborted')
		})
		const { promise, release } = run({ signal: controller.signal })

		await expect(promise).resolves.toBe('abandoned')
		expect(release).toHaveBeenCalledTimes(1)
	})
})

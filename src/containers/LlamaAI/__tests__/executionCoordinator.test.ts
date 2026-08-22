import { describe, expect, it, vi } from 'vitest'
import { ExecutionCoordinator, waitForAbortableDelay } from '~/containers/LlamaAI/executionCoordinator'

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

describe('ExecutionCoordinator', () => {
	it('invalidates and aborts the previous operation before starting another', async () => {
		const coordinator = new ExecutionCoordinator()
		const firstDone = deferred()
		let firstCurrentAfterAbort = true
		let firstAborted = false

		const first = coordinator.run('session-a', 'prompt', async (operation) => {
			operation.signal.addEventListener('abort', () => {
				firstCurrentAfterAbort = operation.isCurrent()
				firstAborted = true
			})
			await firstDone.promise
		})
		const second = coordinator.run('session-b', 'prompt', async (operation) => {
			expect(operation.isCurrent()).toBe(true)
		})

		expect(firstAborted).toBe(true)
		expect(firstCurrentAfterAbort).toBe(false)
		firstDone.resolve()
		await Promise.all([first, second])
	})

	it('shares one operation for concurrent attachment signals', async () => {
		const coordinator = new ExecutionCoordinator()
		const done = deferred()
		const execute = vi.fn(async () => done.promise)

		const first = coordinator.ensure('session-a', 'resume', execute)
		const second = coordinator.ensure('session-a', 'resume', execute)

		expect(execute).toHaveBeenCalledOnce()
		done.resolve()
		await Promise.all([first, second])
	})

	it('runs a requested attachment after a different intent settles', async () => {
		const coordinator = new ExecutionCoordinator()
		const promptDone = deferred()
		const resume = vi.fn(async () => 'attached' as const)

		const prompt = coordinator.run('session-a', 'prompt', async () => promptDone.promise)
		const attachment = coordinator.ensure('session-a', 'resume', resume)
		expect(resume).not.toHaveBeenCalled()

		promptDone.resolve()
		await prompt
		await expect(attachment).resolves.toBe('attached')
		expect(resume).toHaveBeenCalledOnce()
	})

	it('does not start a waiting intent after the session is invalidated', async () => {
		const coordinator = new ExecutionCoordinator()
		const promptDone = deferred()
		const resume = vi.fn(async () => {})

		const prompt = coordinator.run('session-a', 'prompt', async () => promptDone.promise)
		const attachment = coordinator.ensure('session-a', 'resume', resume)
		coordinator.invalidate('session-a')
		promptDone.resolve()

		await prompt
		await expect(attachment).rejects.toMatchObject({ name: 'AbortError' })
		expect(resume).not.toHaveBeenCalled()
	})

	it('invalidates a waiter after the current operation has just settled', async () => {
		const coordinator = new ExecutionCoordinator()
		const promptDone = deferred()
		const resume = vi.fn(async () => {})
		const prompt = coordinator.run('session-a', 'prompt', async () => promptDone.promise)
		const invalidateAfterSettlement = prompt.then(() => coordinator.invalidate())
		const attachment = coordinator.ensure('session-a', 'resume', resume)

		promptDone.resolve()
		await invalidateAfterSettlement

		await expect(attachment).rejects.toMatchObject({ name: 'AbortError' })
		expect(resume).not.toHaveBeenCalled()
	})

	it('adopts a real session id without replacing the running operation', async () => {
		const coordinator = new ExecutionCoordinator()
		const done = deferred()
		let observedSessionId: string | null = null

		const running = coordinator.run('temporary', 'prompt', async (operation) => {
			await done.promise
			observedSessionId = operation.sessionId
		})
		coordinator.adoptSession('temporary', 'real')
		const shared = coordinator.ensure('real', 'prompt', async () => {
			throw new Error('must not replace the adopted operation')
		})

		done.resolve()
		await Promise.all([running, shared])
		expect(observedSessionId).toBe('real')
	})

	it('releases ownership when an operation throws before its first await', async () => {
		const coordinator = new ExecutionCoordinator()

		await expect(
			coordinator.run('session-a', 'prompt', () => {
				throw new Error('failed immediately')
			})
		).rejects.toThrow('failed immediately')

		await coordinator.ensure('session-a', 'resume', async () => {})
	})

	it('aborts a retry delay without waiting for its timer', async () => {
		vi.useFakeTimers()
		try {
			const controller = new AbortController()
			const delay = waitForAbortableDelay(5000, controller.signal)
			controller.abort()

			await expect(delay).rejects.toMatchObject({ name: 'AbortError' })
		} finally {
			vi.useRealTimers()
		}
	})
})

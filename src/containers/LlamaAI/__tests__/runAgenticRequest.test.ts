import { describe, expect, test, vi } from 'vitest'
import { ExecutionCoordinator } from '~/containers/LlamaAI/executionCoordinator'
import type { AgenticSSECallbacks } from '~/containers/LlamaAI/fetchAgenticResponse'
import { classifyAgenticRequestError, runAgenticRequest } from '~/containers/LlamaAI/runAgenticRequest'

function callbacks(): AgenticSSECallbacks {
	return {
		onToken: vi.fn(),
		onCharts: vi.fn(),
		onToolCall: vi.fn(),
		onSpawnProgress: vi.fn(),
		onSessionId: vi.fn(),
		onCitations: vi.fn(),
		onError: vi.fn(),
		onDone: vi.fn()
	}
}

describe('runAgenticRequest', () => {
	test.each([
		{ error: Object.assign(new Error('aborted'), { name: 'AbortError' }), kind: 'abort' },
		{ error: Object.assign(new Error('upgrade'), { code: 'FREE_DAILY_LIMIT' }), kind: 'free-limit' },
		{ error: Object.assign(new Error('usage'), { code: 'USAGE_LIMIT_EXCEEDED' }), kind: 'usage-limit' },
		{ error: new Error('Stream ended without done event'), kind: 'temporary-connectivity' },
		{ error: new Error('other'), kind: 'failure' }
	])('classifies $error.message as $kind', ({ error, kind }) => {
		expect(classifyAgenticRequestError(error, new AbortController().signal)).toEqual({ kind, error })
	})

	test('classifies coordinator cancellation as an abort', async () => {
		const coordinator = new ExecutionCoordinator()
		const onError = vi.fn()
		let rejectRequest!: (error: Error) => void
		const request = new Promise<void>((_resolve, reject) => {
			rejectRequest = reject
		})

		const running = coordinator.run('session-1', 'resume', (operation) =>
			runAgenticRequest({
				mode: 'resume',
				operation,
				createCallbacks: callbacks,
				execute: () => request,
				onError
			})
		)
		coordinator.invalidate('session-1')
		rejectRequest(new Error('request canceled'))
		await running

		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'abort' }), expect.any(Object))
	})

	test('logs post-success handler errors without reporting a request failure', async () => {
		const coordinator = new ExecutionCoordinator()
		const onError = vi.fn()
		const onFinally = vi.fn()
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

		try {
			await coordinator.run('session-1', 'prompt', (operation) =>
				runAgenticRequest({
					mode: 'prompt',
					operation,
					createCallbacks: callbacks,
					execute: async () => {},
					onSuccess: async () => {
						throw new Error('post-success failed')
					},
					onError,
					onFinally
				})
			)

			expect(onError).not.toHaveBeenCalled()
			expect(onFinally).toHaveBeenCalledOnce()
			expect(consoleError).toHaveBeenCalledWith(
				'[llama-ai] post-success request handler failed:',
				expect.objectContaining({ message: 'post-success failed' })
			)
		} finally {
			consoleError.mockRestore()
		}
	})
})

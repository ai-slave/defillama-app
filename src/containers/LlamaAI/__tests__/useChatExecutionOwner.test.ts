import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExecutionCoordinator } from '~/containers/LlamaAI/executionCoordinator'
import { AgenticExecutionChangedError, type AgenticSSECallbacks } from '~/containers/LlamaAI/fetchAgenticResponse'
import { useChatExecutionOwner } from '~/containers/LlamaAI/hooks/useChatExecutionOwner'
import type { QueuedMessageElement } from '~/containers/LlamaAI/queue/protocol'
import type { StreamBuffer, StreamDispatch } from '~/containers/LlamaAI/streamState'
import type { Message } from '~/containers/LlamaAI/types'

const transport = vi.hoisted(() => ({
	attach: vi.fn(),
	checkActive: vi.fn(),
	resume: vi.fn()
}))

vi.mock('~/hooks/useStableCallback', () => ({
	useStableCallback: <Args extends unknown[], Result>(callback: (...args: Args) => Result) => callback
}))

vi.mock('~/containers/LlamaAI/fetchAgenticResponse', async (importOriginal) => {
	const original = await importOriginal<typeof import('~/containers/LlamaAI/fetchAgenticResponse')>()
	return {
		...original,
		attachAgenticStream: transport.attach,
		checkActiveExecution: transport.checkActive,
		resumeAgenticStream: transport.resume
	}
})

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

function execution(messageId: string) {
	return {
		messageId,
		status: 'running' as const,
		hasResult: false,
		cursor: 0,
		startedAt: Date.now()
	}
}

function useTestExecutionOwner({
	coordinator = new ExecutionCoordinator(),
	queue = [],
	onSettled = vi.fn(),
	clearRecovery = vi.fn(),
	appendMessage = vi.fn()
}: {
	coordinator?: ExecutionCoordinator
	queue?: QueuedMessageElement[]
	onSettled?: ReturnType<typeof vi.fn<(sessionId: string) => void>>
	clearRecovery?: ReturnType<typeof vi.fn<() => void>>
	appendMessage?: ReturnType<typeof vi.fn<(message: Message) => void>>
} = {}) {
	const dispatch = vi.fn<StreamDispatch>()
	const createCallbacks = ({ buffer }: { buffer: StreamBuffer }) =>
		({
			onMessageId: (messageId: string) => {
				buffer.executionId = messageId
			},
			onToken: (content: string) => {
				buffer.text += content
			}
		}) as AgenticSSECallbacks
	const owner = useChatExecutionOwner({
		appendMessage,
		authorizedFetch: vi.fn() as typeof fetch,
		clearRecovery,
		createCallbacks,
		currentMessageIdRef: { current: null },
		dispatch,
		executionCoordinator: coordinator,
		getCurrentSessionId: () => 'session-a',
		getServerQueue: () => queue,
		onSettled,
		replaceUserMessageId: vi.fn(),
		setPaginationError: vi.fn(),
		setViewError: vi.fn()
	})
	return { ...owner, appendMessage, clearRecovery, dispatch, onSettled }
}

describe('useChatExecutionOwner', () => {
	beforeEach(() => {
		transport.attach.mockReset()
		transport.checkActive.mockReset()
		transport.resume.mockReset()
	})

	it('probes after a prompt operation releases the session', async () => {
		const coordinator = new ExecutionCoordinator()
		const promptDone = deferred()
		const prompt = coordinator.run('session-a', 'prompt', async () => promptDone.promise)
		transport.checkActive.mockResolvedValue({ active: false, execution: null })
		const owner = useTestExecutionOwner({ coordinator })

		const resume = owner.resumeRunningExecution({ targetSessionId: 'session-a' })
		expect(transport.checkActive).not.toHaveBeenCalled()
		promptDone.resolve()
		await prompt

		await expect(resume).resolves.toBe('inactive')
		expect(transport.checkActive).toHaveBeenCalledOnce()
	})

	it('keeps temporary disconnects recoverable instead of settling them', async () => {
		transport.checkActive.mockRejectedValue(new Error('Failed to fetch'))
		const onTemporaryDisconnect = vi.fn()
		const owner = useTestExecutionOwner()

		await expect(owner.resumeRunningExecution({ targetSessionId: 'session-a', onTemporaryDisconnect })).resolves.toBe(
			'temporary-disconnect'
		)
		expect(onTemporaryDisconnect).toHaveBeenCalledOnce()
		expect(owner.onSettled).not.toHaveBeenCalled()
		expect(owner.clearRecovery).not.toHaveBeenCalled()
	})

	it('pins a rearmed queue stream to its observed execution and cursor', async () => {
		vi.useFakeTimers()
		try {
			const queue = [{ id: 'queue-1', state: 'firing' }] as QueuedMessageElement[]
			transport.attach
				.mockImplementationOnce(async ({ callbacks, eventCounter }) => {
					callbacks.onMessageId?.('execution-1')
					callbacks.onToken('partial')
					eventCounter.count = 2
					return 'timeout'
				})
				.mockResolvedValueOnce('paused')
			const owner = useTestExecutionOwner({ queue })

			const attached = owner.ensureQueueAttached('session-a')
			await vi.advanceTimersByTimeAsync(1000)
			await attached

			expect(transport.attach).toHaveBeenCalledTimes(2)
			expect(transport.attach.mock.calls[1][0]).toMatchObject({
				expectedMessageId: 'execution-1',
				from: 2
			})
		} finally {
			vi.useRealTimers()
		}
	})

	it('separates buffered output when the active execution changes', async () => {
		transport.checkActive.mockResolvedValue({ active: true, execution: execution('execution-1') })
		transport.resume
			.mockImplementationOnce(async ({ callbacks }) => {
				callbacks.onToken('first answer')
				throw new AgenticExecutionChangedError(execution('execution-2'))
			})
			.mockImplementationOnce(async ({ callbacks }) => {
				callbacks.onToken('second answer')
			})
		const owner = useTestExecutionOwner()

		await expect(owner.resumeRunningExecution({ targetSessionId: 'session-a' })).resolves.toBe('settled')

		expect(owner.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'first answer' }))
		expect(transport.resume.mock.calls[1][0]).toMatchObject({
			expectedMessageId: 'execution-2',
			from: 0
		})
	})

	it('reports an invalidated replay as aborted instead of settled', async () => {
		const coordinator = new ExecutionCoordinator()
		transport.checkActive.mockResolvedValue({
			active: false,
			execution: { ...execution('execution-1'), cursor: 1, hasResult: true, status: 'completed' }
		})
		transport.resume.mockImplementation(
			async ({ abortSignal }) =>
				new Promise<void>((_resolve, reject) => {
					abortSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
				})
		)
		const owner = useTestExecutionOwner({ coordinator })

		const replay = owner.resumeRunningExecution({ targetSessionId: 'session-a' })
		await vi.waitFor(() => expect(transport.resume).toHaveBeenCalledOnce())
		coordinator.invalidate()

		await expect(replay).resolves.toBe('aborted')
		expect(owner.onSettled).not.toHaveBeenCalled()
	})
})

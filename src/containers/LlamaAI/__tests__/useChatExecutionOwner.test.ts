// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ExecutionCoordinator } from '~/containers/LlamaAI/executionCoordinator'
import { useChatExecutionOwner } from '~/containers/LlamaAI/hooks/useChatExecutionOwner'
import type { QueuedMessageElement } from '~/containers/LlamaAI/queue/protocol'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import { createStreamAccumulator, type StreamDispatch } from '~/containers/LlamaAI/streamState'
import type { Message } from '~/containers/LlamaAI/types'
import { waitForUi } from '~/utils/testing/waitForUi'

const ACTIVE_URL = 'https://ai.llama.fi/agentic/active/session-a'
const STREAM_URL = 'https://ai.llama.fi/agentic/stream/session-a'

function execution(messageId: string, overrides: Record<string, unknown> = {}) {
	return { messageId, status: 'running', hasResult: false, cursor: 0, startedAt: 1_700_000_000_000, ...overrides }
}

function sse(events: Array<object>) {
	return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
		headers: { 'content-type': 'text/event-stream' }
	})
}

type Answer = Response | Error | ((init?: RequestInit) => Promise<Response>)

/** The authenticated AI server: each endpoint answers its requests in order. */
function aiServer(routes: { active?: Array<Answer>; stream?: Array<Answer> }) {
	const requests: Array<string> = []
	const authorizedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input)
		requests.push(url)
		const queue = url.startsWith(ACTIVE_URL) ? routes.active : url.startsWith(STREAM_URL) ? routes.stream : undefined
		const answer = queue?.shift()
		if (!answer) throw new Error(`unexpected request ${url}`)
		if (answer instanceof Error) throw answer
		return typeof answer === 'function' ? answer(init) : answer
	}
	return { authorizedFetch: authorizedFetch as typeof fetch, requests }
}

/** Fails within a second when a promise the fake server should settle never does; vi.waitFor keeps real timers. */
async function bounded<T>(promise: Promise<T>): Promise<T> {
	let settled = false
	void promise.then(
		() => (settled = true),
		() => (settled = true)
	)
	await waitForUi(() => expect(settled).toBe(true), { timeout: 1000 })
	return promise
}

let root: Root
beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {})
	root = createRoot(document.createElement('div'))
})
afterEach(async () => {
	await act(async () => root.unmount())
	vi.useRealTimers()
	vi.restoreAllMocks()
})

async function mountOwner({
	authorizedFetch,
	coordinator = new ExecutionCoordinator(),
	queue = []
}: {
	authorizedFetch: typeof fetch
	coordinator?: ExecutionCoordinator
	queue?: Array<QueuedMessageElement>
}) {
	const appended: Array<Message> = []
	const onSettled = vi.fn()
	const clearRecovery = vi.fn()
	const dispatch: StreamDispatch = () => {}
	const currentMessageIdRef = { current: null as string | null }
	let owner!: ReturnType<typeof useChatExecutionOwner>
	function Harness() {
		owner = useChatExecutionOwner({
			appendMessage: (message) => appended.push(message),
			authorizedFetch,
			clearRecovery,
			createCallbacks: ({ buffer, isCurrent }) =>
				createAgenticCallbacks({
					isCurrent,
					buffer,
					dispatch,
					currentMessageIdRef,
					appendMessage: (message) => appended.push(message),
					notify: () => {}
				}),
			currentMessageIdRef,
			dispatch,
			executionCoordinator: coordinator,
			getCurrentSessionId: () => 'session-a',
			getServerQueue: () => queue,
			onSettled,
			replaceUserMessageId: () => {},
			setPaginationError: () => {},
			setViewError: () => {}
		})
		return null
	}
	await act(async () => root.render(createElement(Harness)))
	return { owner, appended, onSettled, clearRecovery }
}

describe('useChatExecutionOwner', () => {
	test('waits for a running prompt to release the session before probing for an execution', async () => {
		const coordinator = new ExecutionCoordinator()
		const prompt = Promise.withResolvers<void>()
		const running = coordinator.run('session-a', 'prompt', () => prompt.promise)
		const server = aiServer({ active: [Response.json({ active: false })] })
		const { owner } = await mountOwner({ authorizedFetch: server.authorizedFetch, coordinator })

		const resume = owner.resumeIfRunning({ targetSessionId: 'session-a' })
		expect(server.requests).toEqual([])
		prompt.resolve()
		await running

		await expect(bounded(resume)).resolves.toBe('inactive')
		expect(server.requests).toEqual([ACTIVE_URL])
	})

	test('keeps a temporary disconnect recoverable instead of settling it', async () => {
		const server = aiServer({ active: [new TypeError('Failed to fetch')] })
		const onTemporaryDisconnect = vi.fn()
		const { owner, onSettled, clearRecovery } = await mountOwner({ authorizedFetch: server.authorizedFetch })

		await expect(owner.resumeIfRunning({ targetSessionId: 'session-a', onTemporaryDisconnect })).resolves.toBe(
			'temporary-disconnect'
		)
		expect(onTemporaryDisconnect).toHaveBeenCalledOnce()
		expect(onSettled).not.toHaveBeenCalled()
		expect(clearRecovery).not.toHaveBeenCalled()
	})

	test('rearms a timed-out queue wait on the execution and cursor it already observed', async () => {
		const queue = [
			{ id: 'queue-1', state: 'firing', message: 'next', researchMode: false, client: 'web', queuedAt: '2026-01-01' }
		] as Array<QueuedMessageElement>
		const waitEnded = (reason: string) => ({
			type: 'queue_wait_ended',
			reason,
			sessionId: 'session-a',
			revision: 1,
			queue
		})
		const server = aiServer({
			stream: [
				sse([
					{ type: 'message_id', messageId: 'execution-1' },
					{ type: 'response_chunk', content: 'partial' },
					waitEnded('timeout')
				]),
				sse([waitEnded('paused')])
			]
		})
		const { owner } = await mountOwner({ authorizedFetch: server.authorizedFetch, queue })
		vi.useFakeTimers()

		const attached = owner.ensureQueueAttached('session-a')
		// The retry backoff after a timed-out wait.
		await vi.advanceTimersByTimeAsync(1000)
		await bounded(attached)

		expect(server.requests).toEqual([
			`${STREAM_URL}?from=0&waitMs=90000`,
			`${STREAM_URL}?from=2&waitMs=90000&expectedMessageId=execution-1`
		])
	})

	test('a wait that times out with no new events keeps the cursor instead of replaying the answer', async () => {
		const queue = [
			{ id: 'queue-1', state: 'firing', message: 'next', researchMode: false, client: 'web', queuedAt: '2026-01-01' }
		] as Array<QueuedMessageElement>
		const waitEnded = (reason: string) => ({
			type: 'queue_wait_ended',
			reason,
			sessionId: 'session-a',
			revision: 1,
			queue
		})
		const server = aiServer({
			stream: [
				sse([
					{ type: 'message_id', messageId: 'execution-1' },
					{ type: 'response_chunk', content: 'partial' },
					waitEnded('timeout')
				]),
				sse([waitEnded('timeout')]),
				sse([waitEnded('paused')])
			]
		})
		const { owner } = await mountOwner({ authorizedFetch: server.authorizedFetch, queue })
		vi.useFakeTimers()

		const attached = owner.ensureQueueAttached('session-a')
		// Two retry backoffs, one after each timed-out wait.
		await vi.advanceTimersByTimeAsync(1000)
		await vi.advanceTimersByTimeAsync(1000)
		await bounded(attached)

		expect(server.requests.slice(1)).toEqual([
			`${STREAM_URL}?from=2&waitMs=90000&expectedMessageId=execution-1`,
			`${STREAM_URL}?from=2&waitMs=90000&expectedMessageId=execution-1`
		])
	})

	test('commits the buffered answer separately when the active execution changes', async () => {
		const buffer = createStreamAccumulator()
		buffer.executionId = 'execution-1'
		buffer.text = 'first answer'
		const server = aiServer({
			active: [Response.json({ active: true, execution: execution('execution-1') })],
			stream: [
				Response.json({ error: 'execution_changed', execution: execution('execution-2') }, { status: 409 }),
				sse([{ type: 'response_chunk', content: 'second answer' }, { type: 'done' }])
			]
		})
		const { owner, appended } = await mountOwner({ authorizedFetch: server.authorizedFetch })

		await expect(owner.resumeIfRunning({ targetSessionId: 'session-a', buffer })).resolves.toBe('settled')

		expect(appended.map((message) => message.content)).toEqual(['first answer', 'second answer'])
		expect(server.requests.slice(1)).toEqual([
			`${STREAM_URL}?from=0&expectedMessageId=execution-1`,
			`${STREAM_URL}?from=0&expectedMessageId=execution-2`
		])
	})

	test('keeps the partial answer and reports aborted when a running stream is cut off', async () => {
		const buffer = createStreamAccumulator()
		buffer.executionId = 'execution-1'
		buffer.text = 'partial answer'
		const server = aiServer({
			active: [Response.json({ active: true, execution: execution('execution-1') })],
			stream: [new DOMException('The operation was aborted', 'AbortError') as unknown as Error]
		})
		const { owner, appended, onSettled } = await mountOwner({ authorizedFetch: server.authorizedFetch })

		await expect(bounded(owner.resumeIfRunning({ targetSessionId: 'session-a', buffer }))).resolves.toBe('aborted')

		expect(appended.map((message) => message.content)).toEqual(['partial answer'])
		expect(onSettled).not.toHaveBeenCalled()
	})

	test('does not replay a completed execution when opening a session that already has the answer', async () => {
		const server = aiServer({
			active: [
				Response.json({
					active: false,
					execution: execution('execution-1', { cursor: 4, hasResult: true, status: 'completed' })
				})
			]
		})
		const { owner, onSettled } = await mountOwner({ authorizedFetch: server.authorizedFetch })

		await expect(owner.resumeIfRunning({ targetSessionId: 'session-a' })).resolves.toBe('inactive')

		expect(server.requests).toEqual([ACTIVE_URL])
		expect(onSettled).not.toHaveBeenCalled()
	})

	test('recovery does not replay a completed execution the client already received in full', async () => {
		const completed = execution('execution-1', { cursor: 4, hasResult: true, status: 'completed' })
		const caughtUp = createStreamAccumulator()
		caughtUp.executionId = 'execution-1'
		caughtUp.receivedEventCount = 4
		const server = aiServer({ active: [Response.json({ active: false, execution: completed })] })
		const { owner, onSettled } = await mountOwner({ authorizedFetch: server.authorizedFetch })

		await expect(owner.recoverExecution({ targetSessionId: 'session-a', buffer: caughtUp })).resolves.toBe('inactive')
		expect(server.requests).toEqual([ACTIVE_URL])
		expect(onSettled).not.toHaveBeenCalled()
	})

	test('reports an invalidated replay as aborted instead of settled', async () => {
		const coordinator = new ExecutionCoordinator()
		const streamRequested = Promise.withResolvers<void>()
		const server = aiServer({
			active: [
				Response.json({
					active: false,
					execution: execution('execution-1', { cursor: 1, hasResult: true, status: 'completed' })
				})
			],
			stream: [
				// Like a real fetch, the pending stream rejects once its request is aborted.
				(init) => {
					streamRequested.resolve()
					return new Promise<Response>((_resolve, reject) =>
						init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
					)
				}
			]
		})
		const { owner, onSettled } = await mountOwner({ authorizedFetch: server.authorizedFetch, coordinator })

		const replay = owner.recoverExecution({ targetSessionId: 'session-a' })
		await bounded(streamRequested.promise)
		coordinator.invalidate()

		await expect(bounded(replay)).resolves.toBe('aborted')
		expect(onSettled).not.toHaveBeenCalled()
	})
})

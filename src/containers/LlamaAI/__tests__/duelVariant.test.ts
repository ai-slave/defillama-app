// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import {
	fetchAgenticResponse,
	parseSSEStream,
	type AgenticSSECallbacks
} from '~/containers/LlamaAI/fetchAgenticResponse'
import { useDuelStream } from '~/containers/LlamaAI/hooks/useDuelStream'

type MockFetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>
type MockFetchSpy = ReturnType<typeof vi.fn<MockFetch>>

function encodeSseEvents(events: Array<string>) {
	return events.map((event) => `data: ${event}\n\n`).join('')
}

function sseReader(...events: Array<string>) {
	const encoder = new TextEncoder()
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(encodeSseEvents(events)))
			controller.close()
		}
	})
	return stream.getReader()
}

function sseResponse(events: Array<string>) {
	return new Response(encodeSseEvents(events), {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' }
	})
}

function readRequestBody(fetchSpy: MockFetchSpy) {
	const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
	if (!init || typeof init.body !== 'string') throw new Error('Expected JSON request body')
	return JSON.parse(init.body) as Record<string, unknown>
}

function callbacks(): AgenticSSECallbacks {
	return {
		onToken: vi.fn(),
		onCharts: vi.fn(),
		onToolCall: vi.fn(),
		onSpawnProgress: vi.fn(),
		onSessionId: vi.fn(),
		onCitations: vi.fn(),
		onThinking: vi.fn(),
		onMessageId: vi.fn(),
		onDuelStart: vi.fn(),
		onArmEvent: vi.fn(),
		onError: vi.fn(),
		onDone: vi.fn()
	}
}

describe('duel capability handshake', () => {
	test('declares duelCapable on every prompt so the backend may sample the turn', async () => {
		const fetchFn = vi.fn<MockFetch>(async () => sseResponse([JSON.stringify({ type: 'done' })]))

		await fetchAgenticResponse({
			mutation: {
				clientMutationId: 'mutation-1',
				message: 'what is defillama?',
				sessionId: 'session-1',
				enablePremiumTools: true
			},
			callbacks: callbacks(),
			fetchFn: fetchFn as unknown as typeof fetch,
			eventCounter: { count: 0 }
		})

		expect(fetchFn.mock.calls[0]?.[0]).toBe(`${AI_SERVER}/agentic`)
		expect(readRequestBody(fetchFn)).toMatchObject({ duelCapable: true })
	})
})

describe('duel stream routing', () => {
	test('routes duel_start to onDuelStart instead of the single-answer pipeline', async () => {
		const cb = callbacks()

		await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'duel_start', pairId: 'pair-1', arms: ['a', 'b'] }),
				JSON.stringify({ type: 'done' })
			),
			cb
		)

		expect(cb.onDuelStart).toHaveBeenCalledWith('pair-1')
		expect(cb.onDone).toHaveBeenCalledOnce()
	})

	test('keeps arm-tagged answer events out of the single-answer callbacks', async () => {
		const cb = callbacks()

		await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'duel_start', pairId: 'pair-1', arms: ['a', 'b'] }),
				JSON.stringify({ type: 'response_chunk', content: 'from arm a', arm: 'a' }),
				JSON.stringify({ type: 'thinking', content: 'from arm b', arm: 'b' }),
				JSON.stringify({ type: 'done' })
			),
			cb
		)

		// Both answers share one stream; anything tagged with an arm must never reach the
		// normal accumulator or the two answers interleave into one garbled message.
		expect(cb.onToken).not.toHaveBeenCalled()
		expect(cb.onThinking).not.toHaveBeenCalled()
		expect(vi.mocked(cb.onArmEvent!).mock.calls.map(([event]) => event)).toEqual([
			{ type: 'response_chunk', content: 'from arm a', arm: 'a' },
			{ type: 'thinking', content: 'from arm b', arm: 'b' }
		])
	})

	test('leaves untagged events on the normal path so a non-duel turn is unchanged', async () => {
		const cb = callbacks()

		await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'session', sessionId: 'session-1' }),
				JSON.stringify({ type: 'response_chunk', content: 'hello' }),
				JSON.stringify({ type: 'message_id', messageId: 'message-1' }),
				JSON.stringify({ type: 'done' })
			),
			cb
		)

		expect(cb.onSessionId).toHaveBeenCalledWith('session-1', undefined)
		expect(cb.onToken).toHaveBeenCalledWith('hello')
		expect(cb.onMessageId).toHaveBeenCalledWith('message-1')
		expect(cb.onDuelStart).not.toHaveBeenCalled()
		expect(cb.onArmEvent).not.toHaveBeenCalled()
	})
})

function mountDuelStream() {
	const root = createRoot(document.createElement('div'))
	let latest: ReturnType<typeof useDuelStream> | null = null

	function Probe() {
		latest = useDuelStream()
		return null
	}

	act(() => root.render(createElement(Probe)))

	return {
		get current() {
			if (!latest) throw new Error('useDuelStream did not mount')
			return latest
		},
		unmount: () => act(() => root.unmount())
	}
}

describe('useDuelStream', () => {
	test('binds each arm to its persisted message id without rendering it as answer content', () => {
		const duel = mountDuelStream()

		act(() => duel.current.start('pair-1', 'answer-a', 'question-1'))
		act(() => {
			duel.current.handleArmEvent({ type: 'arm_message_id', messageId: 'message-a', arm: 'a' })
			duel.current.handleArmEvent({ type: 'arm_message_id', messageId: 'message-b', arm: 'b' })
		})

		// The vote resolves the thread by switching to the winning sibling, so each arm
		// must carry the real persisted id — and the id must never leak into the answer.
		expect(duel.current.a.messageId).toBe('message-a')
		expect(duel.current.b.messageId).toBe('message-b')
		expect(duel.current.a.message).toBeNull()
		expect(duel.current.b.message).toBeNull()

		act(() => {
			duel.current.handleArmEvent({ type: 'response_chunk', content: 'answer a', arm: 'a' })
		})

		expect(duel.current.a.message?.content).toBe('answer a')
		expect(duel.current.a.messageId).toBe('message-a')

		act(() => duel.current.reset())

		expect(duel.current.a.messageId).toBeNull()
		expect(duel.current.b.messageId).toBeNull()

		duel.unmount()
	})

	test('marks only the arm whose response_end arrived as answered', () => {
		const duel = mountDuelStream()

		act(() => duel.current.start('pair-1', 'answer-a', 'question-1'))
		act(() => {
			duel.current.handleArmEvent({ type: 'response_chunk', content: 'answer a', arm: 'a' })
			duel.current.handleArmEvent({ type: 'response_end', arm: 'a' })
		})

		expect(duel.current.a.answered).toBe(true)
		expect(duel.current.b.answered).toBe(false)
		expect(duel.current.a.message?.content).toBe('answer a')

		duel.unmount()
	})

	test('clears arm errors and answers when the next duel starts', () => {
		const duel = mountDuelStream()

		act(() => duel.current.start('pair-1', 'answer-a', 'question-1'))
		act(() => {
			duel.current.handleArmEvent({ type: 'error', content: 'arm failed', arm: 'a' })
			duel.current.handleArmEvent({ type: 'response_end', arm: 'a' })
		})
		expect(duel.current.a.error).toBe('arm failed')
		expect(duel.current.a.answered).toBe(true)

		// The server can open the next duel without the page resetting first.
		act(() => duel.current.start('pair-2', 'answer-c', 'question-2'))

		expect(duel.current.a.error).toBeNull()
		expect(duel.current.a.answered).toBe(false)

		duel.unmount()
	})
})

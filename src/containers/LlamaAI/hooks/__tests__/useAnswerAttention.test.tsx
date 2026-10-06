// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AgenticSSECallbacks } from '~/containers/LlamaAI/fetchAgenticResponse'
import { useAnswerAttention } from '~/containers/LlamaAI/hooks/useAnswerAttention'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import { createStreamAccumulator, createStreamStore, type StreamAction } from '~/containers/LlamaAI/streamState'
import { installUmamiSink } from '~/utils/testing/umamiSink'

const track = installUmamiSink()

let store = createStreamStore()
let entrySource: string | undefined = 'chat'
let markAnswered = () => {}

function Harness() {
	;({ markAnswered } = useAnswerAttention({ streamStore: store, entrySource }))
	return null
}

// The chat wires every request's stream callbacks this way; `done` reports the answer.
function startRun(): AgenticSSECallbacks {
	const callbacks = createAgenticCallbacks({
		isCurrent: () => true,
		buffer: createStreamAccumulator(),
		dispatch: store.dispatch,
		currentMessageIdRef: { current: null },
		appendMessage: () => {},
		notify: () => {},
		onAnswer: () => markAnswered()
	})
	act(() => store.dispatch({ type: 'START_STREAM' }))
	return callbacks
}

function dispatch(action: StreamAction) {
	act(() => store.dispatch(action))
}

function setVisibility(value: 'visible' | 'hidden') {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
	document.dispatchEvent(new Event('visibilitychange'))
}

function events() {
	return track.mock.calls.map(([name, data]) => ({ name, data }))
}

describe('useAnswerAttention', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.useFakeTimers()
		store = createStreamStore()
		entrySource = 'chat'
		setVisibility('visible')
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	async function unmount() {
		await act(async () => root.unmount())
		root = createRoot(container)
	}

	test('records a seen answer with how long the user waited, so bounce can be compared by wait time', async () => {
		entrySource = 'newsletter'
		await act(async () => root.render(<Harness />))
		const run = startRun()
		vi.advanceTimersByTime(12_000)
		act(() => run.onToken('Aave TVL is $30B'))
		act(() => run.onDone())

		expect(events()).toEqual([
			{ name: 'llamaai-answer-view', data: { entry_source: 'newsletter', wait_ms: 12_000, returned: false } }
		])
	})

	test.each<[string, (run: AgenticSSECallbacks) => void]>([
		[
			'an error the stream reported before it ended',
			(run) => {
				act(() => run.onToken('Aave'))
				act(() => run.onError('Tool failed'))
				act(() => run.onDone())
			}
		],
		[
			'a request that failed or hit a limit',
			(run) => {
				act(() => run.onToken('Aave'))
				dispatch({ type: 'RESET_STREAM' })
			}
		],
		[
			'an answer the user stopped',
			(run) => {
				act(() => run.onToken('Aave'))
				dispatch({ type: 'STOP_REQUESTED' })
				act(() => run.onDone())
				dispatch({ type: 'RESET_STREAM' })
			}
		],
		['a stream that ended without any content', (run) => act(() => run.onDone())]
	])('does not count %s as a seen answer, but counts the next answer', async (_, end) => {
		end(startRun())

		const next = startRun()
		vi.advanceTimersByTime(2000)
		act(() => next.onToken('Aave TVL is $30B'))
		act(() => next.onDone())

		expect(events()).toEqual([
			{ name: 'llamaai-answer-view', data: { entry_source: 'chat', wait_ms: 2000, returned: false } }
		])
	})

	test('counts an answer that completes after the server could not stop it', async () => {
		const run = startRun()
		act(() => run.onToken('Aave'))
		dispatch({ type: 'STOP_REQUESTED' })
		dispatch({ type: 'STOP_FAILED', error: 'Could not stop the response. Try again.' })
		vi.advanceTimersByTime(4000)
		act(() => run.onDone())

		expect(events()).toEqual([
			{ name: 'llamaai-answer-view', data: { entry_source: 'chat', wait_ms: 4000, returned: false } }
		])
	})

	test('records a bounce before any text when the tab goes away mid-wait', async () => {
		startRun()
		vi.advanceTimersByTime(8000)
		act(() => setVisibility('hidden'))

		expect(events()).toEqual([
			{
				name: 'llamaai-answer-abandon',
				data: { entry_source: 'chat', waited_ms: 8000, phase: 'before_first_token' }
			}
		])
	})

	test('records a bounce when the user navigates away from the chat mid-wait', async () => {
		const run = startRun()
		act(() => run.onToken('Aave'))
		vi.advanceTimersByTime(3000)
		await unmount()

		expect(events()).toEqual([
			{ name: 'llamaai-answer-abandon', data: { entry_source: 'chat', waited_ms: 3000, phase: 'streaming' } }
		])
	})

	test('does not record a bounce when the user leaves the chat after the answer', async () => {
		const run = startRun()
		act(() => run.onToken('Aave TVL is $30B'))
		act(() => run.onDone())
		await unmount()

		expect(events()).toEqual([
			{ name: 'llamaai-answer-view', data: { entry_source: 'chat', wait_ms: 0, returned: false } }
		])
	})

	test('marks a user who left and came back before the end as returned, not as a clean view', async () => {
		const run = startRun()
		act(() => run.onToken('Aave'))
		act(() => setVisibility('hidden'))
		act(() => setVisibility('hidden'))
		act(() => setVisibility('visible'))
		act(() => run.onDone())

		expect(events()).toEqual([
			{ name: 'llamaai-answer-abandon', data: { entry_source: 'chat', waited_ms: 0, phase: 'streaming' } },
			{ name: 'llamaai-answer-view', data: { entry_source: 'chat', wait_ms: 0, returned: true } }
		])
	})

	test('does not count an answer that finished while the tab was hidden as seen', async () => {
		const run = startRun()
		act(() => run.onToken('Aave'))
		act(() => setVisibility('hidden'))
		act(() => run.onDone())

		expect(events()).toEqual([
			{ name: 'llamaai-answer-abandon', data: { entry_source: 'chat', waited_ms: 0, phase: 'streaming' } }
		])
	})
})

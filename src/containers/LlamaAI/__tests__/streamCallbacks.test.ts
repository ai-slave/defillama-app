import { describe, expect, test, vi } from 'vitest'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import {
	createInitialStreamState,
	createStreamAccumulator,
	streamReducer,
	type StreamDispatch
} from '~/containers/LlamaAI/streamState'

function setupCallbacks(isCurrent = true, deferEmptyDone = false) {
	const buffer = createStreamAccumulator()
	const dispatch = vi.fn() as unknown as StreamDispatch
	const appendMessage = vi.fn()
	const notify = vi.fn()
	const onCompletion = vi.fn()
	const currentMessageIdRef = { current: 'assistant-1' }

	const callbacks = createAgenticCallbacks({
		isCurrent: () => isCurrent,
		buffer,
		dispatch,
		currentMessageIdRef,
		appendMessage,
		deferEmptyDone,
		onCompletion,
		notify
	})

	return { appendMessage, buffer, callbacks, currentMessageIdRef, dispatch, notify, onCompletion }
}

describe('createAgenticCallbacks', () => {
	test('ignores stale request events', () => {
		const { appendMessage, buffer, callbacks, dispatch, notify } = setupCallbacks(false)

		callbacks.onToken('hello')
		callbacks.onDone()

		expect(buffer.text).toBe('')
		expect(dispatch).not.toHaveBeenCalled()
		expect(appendMessage).not.toHaveBeenCalled()
		expect(notify).not.toHaveBeenCalled()
	})

	test('updates buffer and dispatches live stream actions', () => {
		const { appendMessage, buffer, callbacks, currentMessageIdRef, dispatch, notify, onCompletion } = setupCallbacks()

		callbacks.onToken('[REPORT_START]hello')
		callbacks.onCitations(['https://example.com', 'https://example.com'])
		callbacks.onDone()

		expect(buffer.text).toBe('hello')
		expect(buffer.legacyUrlCitations).toEqual(['https://example.com'])
		expect(buffer.citations).toEqual([])
		expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAR_ACTIVITY' })
		expect(dispatch).toHaveBeenCalledWith({ type: 'APPEND_TOKEN', value: '[REPORT_START]hello' })
		expect(dispatch).toHaveBeenCalledWith({ type: 'COMMIT_STREAM' })
		expect(appendMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				role: 'assistant',
				content: 'hello',
				id: 'assistant-1'
			})
		)
		expect(currentMessageIdRef.current).toBeNull()
		expect(notify).toHaveBeenCalledOnce()
		expect(onCompletion).toHaveBeenCalledWith('assistant-1')
	})

	test('accumulates terminal ops for the committed message and drops stale ones', () => {
		const drawing = {
			symbol: 'HYPE',
			interval: '1D',
			ops: [{ type: 'hline' as const, id: 'ai_1', number: 1, price: 42 }]
		}
		const live = setupCallbacks()

		live.callbacks.onTerminalOps?.(drawing)
		live.callbacks.onTerminalOps?.({ ...drawing, ops: [{ type: 'clear' as const, ids: ['ai_1'] }] })
		live.callbacks.onDone()

		expect(live.buffer.terminalOps).toEqual({
			symbol: 'HYPE',
			interval: '1D',
			ops: [
				{ type: 'hline', id: 'ai_1', number: 1, price: 42 },
				{ type: 'clear', ids: ['ai_1'] }
			]
		})
		expect(live.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ terminalOps: live.buffer.terminalOps }))

		const stale = setupCallbacks(false)
		stale.callbacks.onTerminalOps?.(drawing)

		expect(stale.buffer.terminalOps).toBeNull()
	})

	test('commits the assistant message only once when done fires twice', () => {
		const { appendMessage, callbacks, notify, onCompletion } = setupCallbacks()

		callbacks.onToken('hello')
		callbacks.onDone()
		callbacks.onDone()

		expect(appendMessage).toHaveBeenCalledOnce()
		expect(notify).toHaveBeenCalledOnce()
		expect(onCompletion).toHaveBeenCalledOnce()
	})

	test('writes unified fact-check refs into buffer.citations without altering text', () => {
		const { buffer, callbacks, dispatch } = setupCallbacks()

		callbacks.onToken('plain prose')
		callbacks.onFactCheckCitations?.([{ id: 1, sourceType: 'data', label: 'DefiLlama warehouse' }])

		expect(buffer.text).toBe('plain prose')
		expect(buffer.citations).toEqual([{ id: 1, sourceType: 'data', label: 'DefiLlama warehouse' }])
		expect(buffer.legacyUrlCitations).toEqual([])
		expect(dispatch).toHaveBeenCalledWith({
			type: 'SET_CITATIONS',
			citations: [{ id: 1, sourceType: 'data', label: 'DefiLlama warehouse' }]
		})
	})

	test('swaps buffer text to finalized [n] string when response is present', () => {
		const { buffer, callbacks, dispatch } = setupCallbacks()

		callbacks.onToken('plain prose')
		callbacks.onFactCheckCitations?.(
			[{ id: 1, sourceType: 'data', label: 'DefiLlama warehouse' }],
			'finalized prose [1]'
		)

		expect(buffer.text).toBe('finalized prose [1]')
		expect(buffer.citations).toEqual([{ id: 1, sourceType: 'data', label: 'DefiLlama warehouse' }])
		expect(dispatch).toHaveBeenCalledWith({
			type: 'SET_CITATIONS',
			citations: [{ id: 1, sourceType: 'data', label: 'DefiLlama warehouse' }],
			text: 'finalized prose [1]'
		})
	})

	test('defers empty done events when requested', () => {
		const { appendMessage, callbacks, dispatch, notify, onCompletion } = setupCallbacks(true, true)

		callbacks.onDone()
		callbacks.onDone()

		expect(appendMessage).not.toHaveBeenCalled()
		expect(dispatch).not.toHaveBeenCalledWith({ type: 'COMMIT_STREAM' })
		expect(notify).not.toHaveBeenCalled()
		expect(onCompletion).not.toHaveBeenCalled()
	})

	test('the spawn timer starts at the server start time, not when the event arrives', () => {
		let state = createInitialStreamState()
		const callbacks = createAgenticCallbacks({
			isCurrent: () => true,
			buffer: createStreamAccumulator(),
			dispatch: (action) => {
				state = streamReducer(state, action)
			},
			currentMessageIdRef: { current: null },
			appendMessage: vi.fn(),
			notify: vi.fn()
		})

		callbacks.onSpawnProgress({ agentId: 'agent-1', status: 'started', startedAt: 1_700_000_000_000 })
		callbacks.onSpawnProgress({ agentId: 'agent-2', status: 'started', startedAt: 1_700_000_005_000 })

		expect(state.spawnStartTime).toBe(1_700_000_000_000)
	})

	test('turns a tool_call into a running step with its arguments, completed in place by its result', () => {
		const { buffer, callbacks, dispatch } = setupCallbacks()

		callbacks.onThinking('Checking fees. ')
		callbacks.onToolCall({ name: 'execute_sql', params: { query: 'select 1' }, toolCallId: 'c1', isPremium: true })
		callbacks.onToolExecution({ name: 'execute_sql', tool_call_id: 'c1', executionTimeMs: 12, success: true })
		callbacks.onThinking('Done.')

		expect(buffer.steps).toEqual([
			{ kind: 'reasoning', id: 'reasoning-0', text: 'Checking fees. ' },
			expect.objectContaining({
				kind: 'tool',
				name: 'execute_sql',
				label: 'Querying database',
				params: { query: 'select 1' },
				isPremium: true,
				status: 'done'
			}),
			{ kind: 'reasoning', id: 'reasoning-2', text: 'Done.' }
		])
		expect(buffer.toolExecutions).toHaveLength(1)
		expect(dispatch).toHaveBeenCalledWith({
			type: 'APPEND_TOOL_CALL',
			value: { name: 'execute_sql', params: { query: 'select 1' }, toolCallId: 'c1', isPremium: true }
		})
	})
})

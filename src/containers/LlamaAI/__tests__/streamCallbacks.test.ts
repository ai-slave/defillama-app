import { describe, expect, test, vi } from 'vitest'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import { createStreamBuffer, type StreamDispatch } from '~/containers/LlamaAI/streamState'

function setupCallbacks(isCurrent = true, deferEmptyDone = false) {
	const buffer = createStreamBuffer()
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
		toolCallIdRef: { current: 0 },
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

	test('reports the canonical user message id after materializing it', () => {
		const replaceLocalUserMessageId = vi.fn()
		const onUserMessageIdObserved = vi.fn()
		const callbacks = createAgenticCallbacks({
			isCurrent: () => true,
			buffer: createStreamBuffer(),
			dispatch: vi.fn() as unknown as StreamDispatch,
			currentMessageIdRef: { current: null },
			toolCallIdRef: { current: 0 },
			appendMessage: vi.fn(),
			replaceLocalUserMessageId,
			onUserMessageIdObserved,
			notify: vi.fn()
		})

		callbacks.onUserMessageId?.('user-message-1')

		expect(replaceLocalUserMessageId).toHaveBeenCalledWith('user-message-1', undefined)
		expect(onUserMessageIdObserved).toHaveBeenCalledWith('user-message-1')
	})

	test('preserves explicit zero spawn start timestamps', () => {
		const { callbacks, dispatch } = setupCallbacks()

		callbacks.onSpawnProgress({ agentId: 'agent-1', status: 'started', startedAt: 0 })

		expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SPAWN_START_TIME', value: 0 })
	})
})

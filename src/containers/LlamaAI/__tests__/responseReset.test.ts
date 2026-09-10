import { describe, expect, test, vi } from 'vitest'
import { parseSSEStream } from '~/containers/LlamaAI/fetchAgenticResponse'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import {
	createInitialStreamState,
	createStreamBuffer,
	streamReducer,
	type StreamAction,
	type StreamState
} from '~/containers/LlamaAI/streamState'

function sseReader(events: Array<object>) {
	const encoder = new TextEncoder()
	const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(body))
			controller.close()
		}
	})
	return stream.getReader()
}

// The backend emits this sequence when a turn-end correction discards a streamed draft:
// draft one streams, `response_reset`, tools run again, draft two streams, done.
const correctionRetrySequence = [
	{ type: 'response_chunk', content: 'FIRST DRAFT that the user already saw.' },
	{ type: 'response_end' },
	{ type: 'response_reset', reason: 'missing_substantive_answer', attempt: 1 },
	{ type: 'tool_call', name: 'execute_sql', params: { query: 'select 1' }, tool_call_id: 'call-1' },
	{ type: 'tool_execution', name: 'execute_sql', tool_call_id: 'call-1', success: true, executionTimeMs: 12 },
	{ type: 'response_chunk', content: 'SECOND DRAFT with the correction applied.' },
	{ type: 'response_end' },
	{ type: 'message_metadata', content: { completionReason: 'natural' } },
	{ type: 'done' }
]

describe('client handling of a backend correction retry', () => {
	test('drops the discarded draft, keeps the re-run tool step in the timeline, and commits only the second draft', async () => {
		let state: StreamState = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		let stepsBeforeCommit: StreamState['steps'] = []
		const dispatch = (action: StreamAction) => {
			if (action.type === 'COMMIT_STREAM') stepsBeforeCommit = state.steps
			state = streamReducer(state, action)
		}
		const buffer = createStreamBuffer()
		const appendMessage = vi.fn()
		const callbacks = createAgenticCallbacks({
			isCurrent: () => true,
			buffer,
			dispatch,
			currentMessageIdRef: { current: 'assistant-1' },
			appendMessage,
			notify: () => {}
		})

		const result = await parseSSEStream(sseReader(correctionRetrySequence), callbacks)

		expect(result.sawDone).toBe(true)
		expect(state.phase.status).toBe('committed')
		expect(state.isStreaming).toBe(false)
		// The re-run tool is part of what produced the second draft, so its row stays, completed in place.
		expect(stepsBeforeCommit).toEqual([
			expect.objectContaining({ kind: 'tool', name: 'execute_sql', toolCallId: 'call-1', status: 'done' })
		])
		expect(appendMessage).toHaveBeenCalledTimes(1)
		expect(appendMessage.mock.calls[0][0].content).toBe('SECOND DRAFT with the correction applied.')
		expect(appendMessage.mock.calls[0][0].steps).toEqual(stepsBeforeCommit)
	})
})

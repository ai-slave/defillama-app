import { describe, expect, test } from 'vitest'
import { createInitialStreamState, streamReducer } from '~/containers/LlamaAI/streamState'

describe('streamReducer', () => {
	test('preserves prior spawn progress metadata when later updates omit optional fields', () => {
		let state = createInitialStreamState()
		state = streamReducer(state, {
			type: 'UPSERT_SPAWN_PROGRESS',
			value: { id: 'agent-1', status: 'tool_call', tool: 'search', toolCount: 3, chartCount: 1 }
		})

		state = streamReducer(state, {
			type: 'UPSERT_SPAWN_PROGRESS',
			value: { id: 'agent-1', status: 'completed' }
		})

		expect(state.spawnProgress.get('agent-1')).toMatchObject({
			status: 'completed',
			tool: 'search',
			toolCount: 3,
			chartCount: 1
		})
	})

	test('keeps visible streaming todos when a transient empty snapshot arrives', () => {
		let state = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		state = streamReducer(state, {
			type: 'SET_TODOS',
			value: [{ id: 'todo-1', content: 'Research TVL', status: 'in_progress' as const }]
		})

		state = streamReducer(state, { type: 'SET_TODOS', value: [] })

		expect(state.todos).toHaveLength(1)
	})

	test('keeps queue ownership while waiting for the persisted user message', () => {
		const state = streamReducer(createInitialStreamState(), {
			type: 'START_QUEUED_STREAM',
			queueItemId: 'q1'
		})

		expect(state.isStreaming).toBe(true)
		expect(state.pendingQueueItemId).toBe('q1')
	})

	test('shows activity immediately for a direct stream', () => {
		const state = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })

		expect(state.isStreaming).toBe(true)
		expect(state.pendingQueueItemId).toBeNull()
	})

	test('reveals queued activity only for the matching persisted user message', () => {
		const pending = streamReducer(createInitialStreamState(), {
			type: 'START_QUEUED_STREAM',
			queueItemId: 'q1'
		})
		const unrelated = streamReducer(pending, {
			type: 'QUEUED_USER_MESSAGE_READY',
			queueItemId: 'q2'
		})
		const ready = streamReducer(unrelated, {
			type: 'QUEUED_USER_MESSAGE_READY',
			queueItemId: 'q1'
		})

		expect(unrelated.pendingQueueItemId).toBe('q1')
		expect(ready.pendingQueueItemId).toBeNull()
		expect(ready.isStreaming).toBe(true)
	})

	test('keeps the queued handoff pending through Stop settlement', () => {
		const pending = streamReducer(createInitialStreamState(), {
			type: 'START_QUEUED_STREAM',
			queueItemId: 'q1'
		})
		const stopping = streamReducer(pending, { type: 'STOP_REQUESTED' })
		const failed = streamReducer(stopping, { type: 'STOP_FAILED', error: 'Could not stop' })

		expect(stopping.pendingQueueItemId).toBe('q1')
		expect(failed.pendingQueueItemId).toBe('q1')
	})

	test('allows empty todo snapshots to clear non-streaming state', () => {
		const state = {
			...createInitialStreamState(),
			todos: [{ id: 'todo-1', content: 'Research TVL', status: 'completed' as const }]
		}

		expect(streamReducer(state, { type: 'SET_TODOS', value: [] }).todos).toEqual([])
	})

	test('treats malformed todo snapshots as empty arrays', () => {
		const state = {
			...createInitialStreamState(),
			todos: [{ id: 'todo-1', content: 'Research TVL', status: 'completed' as const }]
		}

		expect(streamReducer(state, { type: 'SET_TODOS', value: null }).todos).toEqual([])
	})

	test('keeps the stream active while a stop request is pending', () => {
		const streaming = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		const stopping = streamReducer(streaming, { type: 'STOP_REQUESTED' })

		expect(stopping.phase).toEqual({ status: 'stopping' })
		expect(stopping.isStreaming).toBe(true)
	})

	test('keeps the composer blocked when the stream finishes while Stop is settling', () => {
		const streaming = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		const stopping = streamReducer(streaming, { type: 'STOP_REQUESTED' })
		const committed = streamReducer(stopping, { type: 'COMMIT_STREAM' })

		expect(committed.phase).toEqual({ status: 'stopping' })
		expect(committed.isStreaming).toBe(true)
	})

	test('returns to streaming when the server cannot confirm a stop', () => {
		const streaming = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		const stopping = streamReducer(streaming, { type: 'STOP_REQUESTED' })
		const failed = streamReducer(stopping, { type: 'STOP_FAILED', error: 'Could not stop' })

		expect(failed.phase).toEqual({ status: 'streaming' })
		expect(failed.isStreaming).toBe(true)
		expect(failed.error).toBe('Could not stop')
	})

	test('builds an interleaved step timeline from stream events and keeps it once text arrives', () => {
		let state = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		state = streamReducer(state, { type: 'APPEND_REASONING', value: 'Looking up fees.' })
		state = streamReducer(state, {
			type: 'APPEND_TOOL_CALL',
			value: { name: 'execute_sql', params: { query: 'select 1' }, toolCallId: 'c1' }
		})
		state = streamReducer(state, { type: 'APPEND_REASONING', value: 'Query is running; ' })
		state = streamReducer(state, { type: 'APPEND_REASONING', value: 'chart next.' })
		state = streamReducer(state, {
			type: 'APPEND_TOOL_EXECUTION',
			value: { name: 'execute_sql', tool_call_id: 'c1', executionTimeMs: 30, success: true, resultCount: 2 }
		})
		state = streamReducer(state, { type: 'CLEAR_ACTIVITY' })
		state = streamReducer(state, { type: 'APPEND_TOKEN', value: 'Aave led' })

		expect(state.steps).toEqual([
			{ kind: 'reasoning', id: 'reasoning-0', text: 'Looking up fees.' },
			expect.objectContaining({
				kind: 'tool',
				toolCallId: 'c1',
				status: 'done',
				execution: expect.objectContaining({ resultCount: 2 })
			}),
			{ kind: 'reasoning', id: 'reasoning-2', text: 'Query is running; chart next.' }
		])
		expect(state.toolExecutions).toHaveLength(1)
		expect(state.text).toBe('Aave led')
	})
})

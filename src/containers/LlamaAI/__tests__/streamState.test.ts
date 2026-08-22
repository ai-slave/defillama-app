import { describe, expect, it } from 'vitest'
import { createInitialStreamState, streamReducer } from '~/containers/LlamaAI/streamState'

describe('streamReducer', () => {
	it('preserves prior spawn progress metadata when later updates omit optional fields', () => {
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

	it('keeps visible streaming todos when a transient empty snapshot arrives', () => {
		let state = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		state = streamReducer(state, {
			type: 'SET_TODOS',
			value: [{ id: 'todo-1', content: 'Research TVL', status: 'in_progress' as const }]
		})

		state = streamReducer(state, { type: 'SET_TODOS', value: [] })

		expect(state.todos).toHaveLength(1)
	})

	it('keeps queue ownership while waiting for the persisted user message', () => {
		const state = streamReducer(createInitialStreamState(), {
			type: 'START_QUEUED_STREAM',
			queueItemId: 'q1'
		})

		expect(state.isStreaming).toBe(true)
		expect(state.pendingQueueItemId).toBe('q1')
	})

	it('shows activity immediately for a direct stream', () => {
		const state = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })

		expect(state.isStreaming).toBe(true)
		expect(state.pendingQueueItemId).toBeNull()
	})

	it('reveals queued activity only for the matching persisted user message', () => {
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

	it('keeps the queued handoff pending through Stop settlement', () => {
		const pending = streamReducer(createInitialStreamState(), {
			type: 'START_QUEUED_STREAM',
			queueItemId: 'q1'
		})
		const stopping = streamReducer(pending, { type: 'STOP_REQUESTED' })
		const failed = streamReducer(stopping, { type: 'STOP_FAILED', error: 'Could not stop' })

		expect(stopping.pendingQueueItemId).toBe('q1')
		expect(failed.pendingQueueItemId).toBe('q1')
	})

	it('allows empty todo snapshots to clear non-streaming state', () => {
		const state = {
			...createInitialStreamState(),
			todos: [{ id: 'todo-1', content: 'Research TVL', status: 'completed' as const }]
		}

		expect(streamReducer(state, { type: 'SET_TODOS', value: [] }).todos).toEqual([])
	})

	it('treats malformed todo snapshots as empty arrays', () => {
		const state = {
			...createInitialStreamState(),
			todos: [{ id: 'todo-1', content: 'Research TVL', status: 'completed' as const }]
		}

		expect(streamReducer(state, { type: 'SET_TODOS', value: null }).todos).toEqual([])
	})

	it('keeps the stream active while a stop request is pending', () => {
		const streaming = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		const stopping = streamReducer(streaming, { type: 'STOP_REQUESTED' })

		expect(stopping.phase).toEqual({ status: 'stopping' })
		expect(stopping.isStreaming).toBe(true)
	})

	it('keeps the composer blocked when the stream finishes while Stop is settling', () => {
		const streaming = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		const stopping = streamReducer(streaming, { type: 'STOP_REQUESTED' })
		const committed = streamReducer(stopping, { type: 'COMMIT_STREAM' })

		expect(committed.phase).toEqual({ status: 'stopping' })
		expect(committed.isStreaming).toBe(true)
	})

	it('returns to streaming when the server cannot confirm a stop', () => {
		const streaming = streamReducer(createInitialStreamState(), { type: 'START_STREAM' })
		const stopping = streamReducer(streaming, { type: 'STOP_REQUESTED' })
		const failed = streamReducer(stopping, { type: 'STOP_FAILED', error: 'Could not stop' })

		expect(failed.phase).toEqual({ status: 'streaming' })
		expect(failed.isStreaming).toBe(true)
		expect(failed.error).toBe('Could not stop')
	})
})

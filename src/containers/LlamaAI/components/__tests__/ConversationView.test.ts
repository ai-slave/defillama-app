import { describe, expect, test } from 'vitest'
import { shouldShowLiveTodoChecklist } from '~/containers/LlamaAI/components/ConversationView'

describe('shouldShowLiveTodoChecklist', () => {
	test('hides restored todos when no run is active', () => {
		expect(
			shouldShowLiveTodoChecklist({
				todoCount: 3,
				isStreaming: false,
				recoveryStatus: 'idle',
				activeToolCallCount: 0,
				spawnProgressCount: 0,
				isCompacting: false
			})
		).toBe(false)
	})

	test('shows todos while a run is active', () => {
		expect(
			shouldShowLiveTodoChecklist({
				todoCount: 3,
				isStreaming: true,
				recoveryStatus: 'idle',
				activeToolCallCount: 0,
				spawnProgressCount: 0,
				isCompacting: false
			})
		).toBe(true)
	})
})

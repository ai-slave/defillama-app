import { describe, expect, it } from 'vitest'
import { createStreamBuffer } from '~/containers/LlamaAI/streamState'
import { prepareQueueAttachExecution } from '~/containers/LlamaAI/utils/queueAttach'

describe('prepareQueueAttachExecution', () => {
	it('starts the stream for the first attachment even without an execution id', () => {
		const result = prepareQueueAttachExecution(null, null)

		expect(result.resetStream).toBe(true)
	})

	it('keeps the buffer and replay cursor for the same execution', () => {
		const buffer = createStreamBuffer()
		buffer.text = 'partial answer'
		buffer.receivedEventCount = 7

		const result = prepareQueueAttachExecution({ id: 'queue-1', buffer }, 'queue-1')

		expect(result.resetStream).toBe(false)
		expect(result.execution.buffer).toBe(buffer)
		expect(result.execution.buffer.receivedEventCount).toBe(7)
	})

	it('starts a clean buffer when the execution identity changes', () => {
		const buffer = createStreamBuffer()
		buffer.receivedEventCount = 7

		const result = prepareQueueAttachExecution({ id: 'queue-1', buffer }, 'queue-2')

		expect(result.resetStream).toBe(true)
		expect(result.execution.id).toBe('queue-2')
		expect(result.execution.buffer).not.toBe(buffer)
		expect(result.execution.buffer.receivedEventCount).toBe(0)
	})
})

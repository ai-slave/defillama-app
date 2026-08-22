import { describe, expect, it } from 'vitest'
import { decodeActiveExecutionResponse, decodeExecutionSnapshot } from '~/containers/LlamaAI/executionProtocol'

const execution = {
	cursor: 4,
	hasResult: false,
	messageId: 'message-1',
	queueItemId: 'queue-1',
	startedAt: 123,
	status: 'running' as const
}

describe('execution protocol', () => {
	it('decodes the canonical execution snapshot', () => {
		expect(decodeExecutionSnapshot(execution)).toEqual(execution)
	})

	it('normalizes the legacy active response during rolling deployment', () => {
		expect(
			decodeActiveExecutionResponse({
				active: true,
				status: 'running',
				startedAt: 123,
				eventCount: 4,
				messageId: 'message-1',
				queueItemId: 'queue-1',
				hasResult: false
			})
		).toEqual({ active: true, execution })
	})

	it('rejects a cursor that could produce an invalid replay offset', () => {
		expect(() => decodeExecutionSnapshot({ ...execution, cursor: Number.NaN })).toThrow('Invalid execution snapshot')
	})

	it('rejects contradictory active state', () => {
		expect(() => decodeActiveExecutionResponse({ active: true })).toThrow('Invalid active execution response')
		expect(() => decodeActiveExecutionResponse({ active: false, execution })).toThrow(
			'Invalid active execution response'
		)
	})
})

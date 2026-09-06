import { describe, expect, test } from 'vitest'
import { decodeQueueSnapshot } from '~/containers/LlamaAI/queue/protocol'

const pending = {
	id: 'q1',
	state: 'pending' as const,
	message: 'follow up',
	researchMode: false,
	client: 'web' as const,
	queuedAt: '2026-08-21T10:00:00.000Z'
}

describe('queue protocol', () => {
	test('rejects the whole snapshot when a row has an impossible state shape', () => {
		expect(decodeQueueSnapshot({ sessionId: 's1', revision: 1, queue: [{ ...pending, reason: 'expired' }] })).toBeNull()
		expect(
			decodeQueueSnapshot({ sessionId: 's1', revision: 1, queue: [{ ...pending, images: [{ id: 'image-1' }] }] })
		).toBeNull()
	})
})

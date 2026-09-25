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
	test('decodes a snapshot of pending, editing and not_sent rows as sent', () => {
		const queue = [
			{ ...pending, images: [{ id: 'image-1', url: 'https://example.com/a.png' }] },
			{ ...pending, id: 'q2', state: 'editing', editLeaseId: 'lease-1', editExpiresAt: '2026-08-21T10:05:00.000Z' },
			{ ...pending, id: 'q3', state: 'not_sent', reason: 'expired' }
		]
		expect(decodeQueueSnapshot({ sessionId: 's1', revision: 4, queue })).toEqual({
			sessionId: 's1',
			revision: 4,
			queue
		})
	})

	test('rejects the whole snapshot when a row has an impossible state shape', () => {
		expect(decodeQueueSnapshot({ sessionId: 's1', revision: 1, queue: [{ ...pending, reason: 'expired' }] })).toBeNull()
		expect(
			decodeQueueSnapshot({ sessionId: 's1', revision: 1, queue: [{ ...pending, images: [{ id: 'image-1' }] }] })
		).toBeNull()
	})
})

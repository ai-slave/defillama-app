import { describe, expect, test } from 'vitest'
import type { QueuedMessageElement } from '~/containers/LlamaAI/queue/protocol'
import { materializePersistedUserMessage } from '~/containers/LlamaAI/utils/materializeUserMessage'

const firedItem: QueuedMessageElement = {
	id: 'queue-1',
	state: 'firing',
	message: 'queued prompt',
	researchMode: false,
	client: 'web',
	queuedAt: '2026-08-21T00:00:00.000Z'
}

describe('materializePersistedUserMessage', () => {
	test('materializes a queued prompt by queue identity without rewriting a direct-send row', () => {
		const messages = [{ role: 'user' as const, content: 'direct prompt', id: 'local-1' }]

		const result = materializePersistedUserMessage(messages, 'persisted-queue', 'queue-1', firedItem)

		expect(result).toEqual([
			{ role: 'user', content: 'direct prompt', id: 'local-1' },
			{ role: 'user', content: 'queued prompt', id: 'persisted-queue' }
		])
	})

	test('rewrites the optimistic tail only for a direct send without queue identity', () => {
		const messages = [{ role: 'user' as const, content: 'direct prompt', id: 'local-1' }]

		expect(materializePersistedUserMessage(messages, 'persisted-direct', undefined, null)).toEqual([
			{ role: 'user', content: 'direct prompt', id: 'persisted-direct' }
		])
	})

	// A queued prompt whose payload is missing must not borrow the direct-send row's text, which would
	// attach the persisted queue id to a different message. Leaving the transcript alone is the lesser
	// fault; keeping the payload available is the queue controller's job.
	test('leaves a direct-send row alone when the queued payload is missing', () => {
		const messages = [{ role: 'user' as const, content: 'direct prompt', id: 'local-1' }]

		expect(materializePersistedUserMessage(messages, 'persisted-queue', 'queue-1', null)).toBe(messages)
		expect(materializePersistedUserMessage(messages, 'persisted-queue', 'queue-1', firedItem)).toEqual([
			{ role: 'user', content: 'direct prompt', id: 'local-1' },
			{ role: 'user', content: 'queued prompt', id: 'persisted-queue' }
		])
	})

	test('does not add a queued prompt that is already in the transcript', () => {
		const messages = [{ role: 'user' as const, content: 'queued prompt', id: 'persisted-queue' }]

		expect(materializePersistedUserMessage(messages, 'persisted-queue', 'queue-1', firedItem)).toBe(messages)
	})

	test('leaves a transcript with no optimistic tail alone', () => {
		const messages = [{ role: 'assistant' as const, content: 'an answer', id: 'assistant-1' }]

		expect(materializePersistedUserMessage(messages, 'persisted-direct', undefined, null)).toBe(messages)
	})
})

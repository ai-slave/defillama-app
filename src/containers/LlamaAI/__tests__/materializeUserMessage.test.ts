import { describe, expect, it } from 'vitest'
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
	it('materializes a queued prompt by queue identity without rewriting a direct-send row', () => {
		const messages = [{ role: 'user' as const, content: 'direct prompt', id: 'local-1' }]

		const result = materializePersistedUserMessage(messages, 'persisted-queue', 'queue-1', firedItem)

		expect(result).toEqual([
			{ role: 'user', content: 'direct prompt', id: 'local-1' },
			{ role: 'user', content: 'queued prompt', id: 'persisted-queue' }
		])
	})

	it('rewrites the optimistic tail only for a direct send without queue identity', () => {
		const messages = [{ role: 'user' as const, content: 'direct prompt', id: 'local-1' }]

		expect(materializePersistedUserMessage(messages, 'persisted-direct', undefined, null)).toEqual([
			{ role: 'user', content: 'direct prompt', id: 'persisted-direct' }
		])
	})
})

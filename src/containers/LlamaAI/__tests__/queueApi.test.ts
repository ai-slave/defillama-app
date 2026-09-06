import { describe, expect, test, vi } from 'vitest'
import {
	cancelAllQueuedMessages,
	continueQueuedMessages,
	queueMessage,
	renewQueuedMessageEdit
} from '~/containers/LlamaAI/api'

function jsonResponse(value: unknown) {
	return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
}

const payload = {
	clientMutationId: 'mutation-1',
	message: 'follow up',
	researchMode: false,
	client: 'web' as const
}

describe('queue API', () => {
	test('accepts only complete revisioned mutation snapshots', async () => {
		const snapshot = { sessionId: 'session-1', revision: 1, queue: [] }
		const authorizedFetch = vi.fn(async () => jsonResponse({ snapshot, maxDepth: 3 }))

		await expect(queueMessage(authorizedFetch, 'session-1', payload)).resolves.toEqual({ snapshot, maxDepth: 3 })

		authorizedFetch.mockResolvedValueOnce(jsonResponse({ snapshot: { ...snapshot, revision: '1' }, maxDepth: 3 }))
		await expect(queueMessage(authorizedFetch, 'session-1', payload)).rejects.toThrow('Invalid queue mutation response')
	})

	test('renews an edit with its lease identity', async () => {
		const snapshot = { sessionId: 'session-1', revision: 2, queue: [] }
		const authorizedFetch = vi.fn(async () => jsonResponse({ snapshot }))

		await expect(renewQueuedMessageEdit(authorizedFetch, 'session-1', 'q1', 'lease-1')).resolves.toEqual({ snapshot })
		expect(authorizedFetch).toHaveBeenCalledWith(
			expect.stringContaining('/agentic/queue/session-1/q1/edit/renew'),
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ editLeaseId: 'lease-1' }) })
		)
	})

	test('uses separate acknowledged commands for Continue and Clear', async () => {
		const snapshot = { sessionId: 'session-1', revision: 2, queue: [] }
		const authorizedFetch = vi.fn(async () => jsonResponse({ snapshot }))

		await continueQueuedMessages(authorizedFetch, 'session-1')
		await cancelAllQueuedMessages(authorizedFetch, 'session-1')

		expect(authorizedFetch).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('/agentic/queue/session-1/continue'),
			expect.objectContaining({ method: 'POST' })
		)
		expect(authorizedFetch).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining('/agentic/queue/session-1'),
			expect.objectContaining({ method: 'DELETE' })
		)
	})
})

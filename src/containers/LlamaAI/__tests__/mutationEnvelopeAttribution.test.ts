import { describe, expect, test } from 'vitest'
import { createAgenticMutationEnvelope } from '../mutationProtocol'

const base = {
	clientMutationId: 'mutation-1',
	enablePremiumTools: false,
	message: 'What is Aave TVL?',
	mode: 'quick' as const,
	sessionId: 'session-1'
}

describe('createAgenticMutationEnvelope attribution', () => {
	test('carries where the question came from and the visitor seed so the backend can join the funnel', () => {
		const envelope = createAgenticMutationEnvelope({
			...base,
			entrySource: 'entity-strip',
			abVisitorId: '00000000-0000-4000-8000-00000000000a'
		})

		expect(envelope.entrySource).toBe('entity-strip')
		expect(envelope.abVisitorId).toBe('00000000-0000-4000-8000-00000000000a')
	})

	test('omits the fields when unknown instead of sending empty values', () => {
		const envelope = createAgenticMutationEnvelope(base)

		expect(envelope).not.toHaveProperty('entrySource')
		expect(envelope).not.toHaveProperty('abVisitorId')
	})
})

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createAgenticMutationEnvelope } from '../mutationProtocol'

const base = {
	clientMutationId: 'mutation-1',
	enablePremiumTools: false,
	message: 'What is Aave TVL?',
	mode: 'quick' as const,
	sessionId: 'session-1'
}

describe('createAgenticMutationEnvelope attribution', () => {
	beforeEach(() => {
		const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
		vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
			return { ...resolvedOptions.call(this), timeZone: 'Asia/Jakarta' }
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('carries where the question came from and the visitor seed so the backend can join the funnel', () => {
		const envelope = createAgenticMutationEnvelope({
			...base,
			entrySource: 'entity-strip',
			abVisitorId: '00000000-0000-4000-8000-00000000000a'
		})

		expect(envelope).toEqual({
			clientMutationId: 'mutation-1',
			enablePremiumTools: false,
			message: 'What is Aave TVL?',
			sessionId: 'session-1',
			entrySource: 'entity-strip',
			abVisitorId: '00000000-0000-4000-8000-00000000000a',
			timezone: 'Asia/Jakarta'
		})
	})

	test('omits the fields when unknown instead of sending empty values', () => {
		expect(createAgenticMutationEnvelope({ ...base, entrySource: '', abVisitorId: '' })).toEqual({
			clientMutationId: 'mutation-1',
			enablePremiumTools: false,
			message: 'What is Aave TVL?',
			sessionId: 'session-1',
			timezone: 'Asia/Jakarta'
		})
	})
})

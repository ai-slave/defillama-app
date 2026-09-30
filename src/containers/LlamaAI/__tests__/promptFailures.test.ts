import { describe, expect, test } from 'vitest'
import {
	canProbeSessionAfterEmptyResponse,
	getForegroundRecoveryIntent,
	materializeFailedPrompt,
	getPromptFailurePolicy,
	isPromptMutationConfirmed,
	projectPromptFailure,
	promptFailuresReducer,
	type FailedRequest,
	type PromptFailure
} from '~/containers/LlamaAI/promptFailures'

function request(clientMutationId: string, optimisticMessageId = `local-${clientMutationId}`): FailedRequest {
	return {
		mutation: {
			clientMutationId,
			enablePremiumTools: false,
			message: `Prompt ${clientMutationId}`,
			sessionId: 'session-a'
		},
		optimisticMessageId
	}
}

function failure(clientMutationId: string): PromptFailure {
	return { kind: 'retry', error: 'Failed', request: request(clientMutationId) }
}

describe('promptFailures', () => {
	test('keeps failures scoped to their session and moves optimistic aliases', () => {
		let state = promptFailuresReducer(new Map(), {
			type: 'remember',
			sessionId: 'temporary-a',
			failure: failure('mutation-a')
		})
		state = promptFailuresReducer(state, {
			type: 'remember',
			sessionId: 'session-b',
			failure: failure('mutation-b')
		})
		state = promptFailuresReducer(state, { type: 'move', fromSessionId: 'temporary-a', toSessionId: 'session-a' })

		expect(state.get('temporary-a')).toBeUndefined()
		expect(state.get('session-a')?.request.mutation.clientMutationId).toBe('mutation-a')
		expect(state.get('session-b')?.request.mutation.clientMutationId).toBe('mutation-b')
	})

	test('does not let stale settlement clear a newer failure', () => {
		let state = promptFailuresReducer(new Map(), {
			type: 'remember',
			sessionId: 'session-a',
			failure: failure('newer')
		})
		state = promptFailuresReducer(state, {
			type: 'clear',
			sessionId: 'session-a',
			clientMutationId: 'older'
		})

		expect(state.get('session-a')?.request.mutation.clientMutationId).toBe('newer')
	})

	test('clears only the confirmed mutation', () => {
		let state = promptFailuresReducer(new Map(), {
			type: 'remember',
			sessionId: 'session-a',
			failure: failure('mutation-a')
		})
		state = promptFailuresReducer(state, {
			type: 'clear',
			sessionId: 'session-a',
			clientMutationId: 'mutation-a'
		})

		expect(state.has('session-a')).toBe(false)
	})

	test('preserves an unresolved prompt through an empty restore without duplicating it', () => {
		const failed = failure('mutation-a')
		const projected = projectPromptFailure([], failed)

		expect(projected).toEqual([{ role: 'user', content: 'Prompt mutation-a', id: 'local-mutation-a' }])
		expect(projectPromptFailure(projected, failed)).toBe(projected)
	})

	test('recognizes the canonical user message id after mutation acceptance', () => {
		const failed: PromptFailure = {
			kind: 'reconnect',
			error: 'Disconnected',
			request: request('mutation-a', 'message-a')
		}
		const restored = [{ role: 'user' as const, content: 'Prompt mutation-a', id: 'message-a' }]

		expect(projectPromptFailure(restored, failed)).toBe(restored)
	})

	test('retries definite failures only by user action and reconnects ambiguous failures automatically', () => {
		expect(getPromptFailurePolicy(failure('mutation-a'))).toMatchObject({
			label: 'Retry',
			automaticallyReconnect: false,
			canDiscard: true
		})
		expect(getPromptFailurePolicy({ ...failure('mutation-b'), kind: 'reconnect' })).toMatchObject({
			label: 'Reconnect',
			automaticallyReconnect: true,
			canDiscard: false
		})
	})

	test('does not treat an empty successful transport as mutation confirmation', () => {
		expect(isPromptMutationConfirmed(false, false)).toBe(false)
		expect(isPromptMutationConfirmed(true, false)).toBe(true)
		expect(isPromptMutationConfirmed(false, true)).toBe(true)
	})

	test('does not let an unconfirmed replay attach to an older session execution', () => {
		expect(canProbeSessionAfterEmptyResponse(true, false)).toBe(false)
		expect(canProbeSessionAfterEmptyResponse(true, true)).toBe(true)
		expect(canProbeSessionAfterEmptyResponse(false, false)).toBe(true)
	})

	test('keeps definite failures idle while reconnecting only ambiguous work', () => {
		expect(
			getForegroundRecoveryIntent({
				hasActiveRecovery: false,
				promptFailure: failure('retry'),
				hasGenericError: false
			})
		).toBe('none')
		expect(
			getForegroundRecoveryIntent({
				hasActiveRecovery: false,
				promptFailure: { ...failure('reconnect'), kind: 'reconnect' },
				hasGenericError: false
			})
		).toBe('replay-prompt')
		expect(
			getForegroundRecoveryIntent({
				hasActiveRecovery: false,
				promptFailure: null,
				hasGenericError: true
			})
		).toBe('probe-session')
		expect(
			getForegroundRecoveryIntent({
				hasActiveRecovery: true,
				promptFailure: failure('retry'),
				hasGenericError: true
			})
		).toBe('resume-recovery')
	})
})

test('preserves attachment sizes in optimistic and failed messages', () => {
	const pending = request('with-file')
	const withFile = {
		...pending,
		mutation: {
			...pending.mutation,
			images: [{ data: 'https://files/demo.csv', mimeType: 'text/csv', filename: 'demo.csv', size: 72 * 1024 * 1024 }]
		}
	}
	expect(materializeFailedPrompt(withFile).images![0].size).toBe(72 * 1024 * 1024)
})

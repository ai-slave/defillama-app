import type { AgenticMutationEnvelope } from '~/containers/LlamaAI/mutationProtocol'
import type { Message } from '~/containers/LlamaAI/types'

export interface FailedRequest {
	readonly mutation: AgenticMutationEnvelope
	readonly optimisticMessageId: string
}

export interface PromptFailure {
	readonly kind: 'retry' | 'reconnect'
	readonly error: string
	readonly request: FailedRequest
}

const PROMPT_FAILURE_POLICIES = {
	retry: { label: 'Retry', automaticallyReconnect: false, canDiscard: true },
	reconnect: { label: 'Reconnect', automaticallyReconnect: true, canDiscard: false }
} as const

export function getPromptFailurePolicy(failure: PromptFailure) {
	return PROMPT_FAILURE_POLICIES[failure.kind]
}

export function isPromptMutationConfirmed(userMessageObserved: boolean, responseContentObserved: boolean) {
	return userMessageObserved || responseContentObserved
}

export function canProbeSessionAfterEmptyResponse(replayingFailure: boolean, mutationConfirmed: boolean) {
	return !replayingFailure || mutationConfirmed
}

export type ForegroundRecoveryIntent = 'resume-recovery' | 'replay-prompt' | 'probe-session' | 'none'

export function getForegroundRecoveryIntent({
	hasActiveRecovery,
	promptFailure,
	hasGenericError
}: {
	hasActiveRecovery: boolean
	promptFailure: PromptFailure | null
	hasGenericError: boolean
}): ForegroundRecoveryIntent {
	if (hasActiveRecovery) return 'resume-recovery'
	if (promptFailure) return getPromptFailurePolicy(promptFailure).automaticallyReconnect ? 'replay-prompt' : 'none'
	return hasGenericError ? 'probe-session' : 'none'
}

export type PromptFailures = ReadonlyMap<string, PromptFailure>

export type PromptFailureAction =
	| { type: 'remember'; sessionId: string; failure: PromptFailure }
	| { type: 'move'; fromSessionId: string; toSessionId: string }
	| { type: 'clear'; sessionId: string; clientMutationId?: string }

export function promptFailuresReducer(state: PromptFailures, action: PromptFailureAction): PromptFailures {
	switch (action.type) {
		case 'remember': {
			const next = new Map(state)
			next.set(action.sessionId, action.failure)
			return next
		}
		case 'move': {
			const failure = state.get(action.fromSessionId)
			if (!failure || action.fromSessionId === action.toSessionId) return state
			const next = new Map(state)
			next.delete(action.fromSessionId)
			if (!state.has(action.toSessionId)) next.set(action.toSessionId, failure)
			return next
		}
		case 'clear': {
			const failure = state.get(action.sessionId)
			if (
				!failure ||
				(action.clientMutationId && failure.request.mutation.clientMutationId !== action.clientMutationId)
			) {
				return state
			}
			const next = new Map(state)
			next.delete(action.sessionId)
			return next
		}
	}
}

export function materializeFailedPrompt(request: FailedRequest): Message {
	const images = request.mutation.images?.map((image) => ({
		url: image.data,
		mimeType: image.mimeType,
		...(image.filename !== undefined ? { filename: image.filename } : {})
	}))
	return {
		role: 'user',
		content: request.mutation.message,
		...(images?.length ? { images } : {}),
		...(request.mutation.quotedText !== undefined ? { quotedText: request.mutation.quotedText } : {}),
		id: request.optimisticMessageId
	}
}

export function projectPromptFailure(messages: Message[], failure: PromptFailure | null): Message[] {
	if (!failure || messages.some((message) => message.id === failure.request.optimisticMessageId)) return messages
	return [...messages, materializeFailedPrompt(failure.request)]
}

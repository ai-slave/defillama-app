import { isTemporaryConnectivityError } from '~/containers/LlamaAI/connectionErrors'
import type { ExecutionOperation } from '~/containers/LlamaAI/executionCoordinator'
import type { AgenticSSECallbacks } from '~/containers/LlamaAI/fetchAgenticResponse'
import type { FreeLimitOffer } from '~/containers/LlamaAI/types'

export type AgenticRequestMode = 'prompt' | 'edit' | 'resume' | 'replay'

export interface UsageLimitError extends Error {
	code?: 'USAGE_LIMIT_EXCEEDED' | 'FACT_CHECKED_REQUIRES_SUBSCRIPTION' | FreeLimitOffer['code']
	// As the server sent them: read through usageLimitOffer, which maps them to the copy's terms.
	details?: { feature?: string; period?: string; limit?: number; resetTime?: string | null }
	upgradeUrl?: string
}

export type FreeLimitError = UsageLimitError & { code: FreeLimitOffer['code'] }

export type AgenticRequestErrorKind = 'abort' | 'free-limit' | 'usage-limit' | 'temporary-connectivity' | 'failure'

export interface ClassifiedAgenticRequestError {
	kind: AgenticRequestErrorKind
	error: UsageLimitError
}

const FREE_LIMIT_CODES = ['FREE_QUESTION_LIMIT', 'FREE_FORM_LIMIT', 'FREE_DAILY_LIMIT'] as const

export function isFreeLimitError(error: UsageLimitError | null | undefined): error is FreeLimitError {
	return !!error?.code && (FREE_LIMIT_CODES as ReadonlyArray<string>).includes(error.code)
}

function toUsageLimitError(error: unknown): UsageLimitError {
	if (error instanceof Error) return error as UsageLimitError
	return new Error(String(error)) as UsageLimitError
}

export function classifyAgenticRequestError(error: unknown, signal: AbortSignal): ClassifiedAgenticRequestError {
	const requestError = toUsageLimitError(error)
	if (signal.aborted || requestError.name === 'AbortError') return { kind: 'abort', error: requestError }
	if (isFreeLimitError(requestError)) return { kind: 'free-limit', error: requestError }
	if (requestError.code === 'USAGE_LIMIT_EXCEEDED' || requestError.code === 'FACT_CHECKED_REQUIRES_SUBSCRIPTION') {
		return { kind: 'usage-limit', error: requestError }
	}
	if (isTemporaryConnectivityError(requestError)) return { kind: 'temporary-connectivity', error: requestError }
	return { kind: 'failure', error: requestError }
}

export interface RunAgenticRequestContext {
	mode: AgenticRequestMode
	requestId: number
	signal: AbortSignal
	isCurrent: () => boolean
	callbacks: AgenticSSECallbacks
	eventCounter: { count: number }
}

interface RunAgenticRequestParams {
	mode: AgenticRequestMode
	operation: ExecutionOperation
	createCallbacks: (context: Omit<RunAgenticRequestContext, 'callbacks'>) => AgenticSSECallbacks
	execute: (context: RunAgenticRequestContext) => Promise<void>
	onSuccess?: (context: RunAgenticRequestContext) => Promise<void> | void
	onError?: (classified: ClassifiedAgenticRequestError, context: RunAgenticRequestContext) => Promise<void> | void
	onFinally?: (context: RunAgenticRequestContext) => void
	initialEventCount?: number
}

export async function runAgenticRequest({
	mode,
	operation,
	createCallbacks,
	execute,
	onSuccess,
	onError,
	onFinally,
	initialEventCount = 0
}: RunAgenticRequestParams): Promise<RunAgenticRequestContext> {
	const eventCounter = { count: initialEventCount }
	const contextWithoutCallbacks = {
		mode,
		requestId: operation.id,
		signal: operation.signal,
		isCurrent: operation.isCurrent,
		eventCounter
	}
	const context: RunAgenticRequestContext = {
		...contextWithoutCallbacks,
		callbacks: createCallbacks(contextWithoutCallbacks)
	}

	try {
		try {
			await execute(context)
		} catch (error) {
			if (!onError) throw error
			await onError(classifyAgenticRequestError(error, operation.signal), context)
			return context
		}
		try {
			await onSuccess?.(context)
		} catch (error) {
			console.error('[llama-ai] post-success request handler failed:', error)
		}
	} finally {
		onFinally?.(context)
	}

	return context
}

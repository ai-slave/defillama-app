import { AI_SERVER } from '~/constants'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import { decodeQueueSnapshot, type QueueSnapshot } from '~/containers/LlamaAI/queue/protocol'
import type { EntityQuestionsResponse } from '~/containers/LlamaAI/types'
import { fetchJson } from '~/utils/async'

/**
 * Fetch suggested follow-up questions for an entity context.
 */
export async function fetchEntityQuestions(
	entitySlug: string,
	entityType: 'protocol' | 'chain' | 'page',
	context?: Record<string, unknown>,
	options?: { throwOnError?: boolean }
): Promise<EntityQuestionsResponse> {
	try {
		let data: EntityQuestionsResponse
		if (context) {
			data = await fetchJson<EntityQuestionsResponse>(`${AI_SERVER}/suggested-questions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entity: entitySlug, entityType, context })
			})
		} else {
			data = await fetchJson<EntityQuestionsResponse>(
				`${AI_SERVER}/suggested-questions?entity=${encodeURIComponent(entitySlug)}&entityType=${encodeURIComponent(entityType)}`
			)
		}
		return { questions: data.questions ?? [], suggestGlobal: data.suggestGlobal ?? false }
	} catch (error) {
		if (options?.throwOnError) throw error
		return { questions: [], suggestGlobal: false }
	}
}

export interface UploadedImage {
	id: string
	url: string
	mimeType?: string
	filename?: string
}

export type { QueuedMessageElement, QueueSnapshot } from '~/containers/LlamaAI/queue/protocol'

interface QueueMutationResponse {
	snapshot: QueueSnapshot
}

function decodeQueueMutationResponse(value: unknown): QueueMutationResponse {
	const snapshot = decodeQueueSnapshot((value as { snapshot?: unknown } | null)?.snapshot)
	if (!snapshot) throw new Error('Invalid queue mutation response')
	return { snapshot }
}

export interface QueueMessagePayload {
	clientMutationId: string
	message: string
	displayMessage?: string
	entities?: Array<{ term: string; slug: string; type?: string }>
	images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>
	researchMode: boolean
	factCheckMode?: boolean
	quotedText?: string
	pageContext?: { entitySlug?: string; entityType?: string; route: string }
	timezone?: string
	client: 'web' | 'mobile'
	projectId?: string
	customInstructions?: string
	blockedSkills?: Array<string>
}

export async function queueMessage(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	payload: QueueMessagePayload,
	signal?: AbortSignal
): Promise<QueueMutationResponse & { maxDepth: number }> {
	const value = await llamaAIRequest<unknown>(authorizedFetch, '/agentic/queue', {
		method: 'POST',
		json: { sessionId, ...payload },
		...(signal ? { signal } : {})
	})
	const response = decodeQueueMutationResponse(value)
	const maxDepth = (value as { maxDepth?: unknown } | null)?.maxDepth
	if (typeof maxDepth !== 'number') throw new Error('Invalid queue mutation response')
	return { ...response, maxDepth }
}

export async function beginQueuedMessageEdit(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(
			authorizedFetch,
			`/agentic/queue/${encodeURIComponent(sessionId)}/${encodeURIComponent(messageId)}/edit`,
			{ method: 'POST', ...(signal ? { signal } : {}) }
		)
	)
}

export async function saveQueuedMessageEdit(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string,
	editLeaseId: string,
	patch: Pick<QueueMessagePayload, 'message'> & Partial<Pick<QueueMessagePayload, 'researchMode' | 'factCheckMode'>>,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(
			authorizedFetch,
			`/agentic/queue/${encodeURIComponent(sessionId)}/${encodeURIComponent(messageId)}/edit`,
			{ method: 'PATCH', json: { editLeaseId, ...patch }, ...(signal ? { signal } : {}) }
		)
	)
}

export async function renewQueuedMessageEdit(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string,
	editLeaseId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(
			authorizedFetch,
			`/agentic/queue/${encodeURIComponent(sessionId)}/${encodeURIComponent(messageId)}/edit/renew`,
			{ method: 'POST', json: { editLeaseId }, ...(signal ? { signal } : {}) }
		)
	)
}

export async function cancelQueuedMessageEdit(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string,
	editLeaseId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(
			authorizedFetch,
			`/agentic/queue/${encodeURIComponent(sessionId)}/${encodeURIComponent(messageId)}/edit`,
			{ method: 'DELETE', json: { editLeaseId }, ...(signal ? { signal } : {}) }
		)
	)
}

export async function cancelQueuedMessage(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(
			authorizedFetch,
			`/agentic/queue/${encodeURIComponent(sessionId)}/${encodeURIComponent(messageId)}`,
			{ method: 'DELETE', ...(signal ? { signal } : {}) }
		)
	)
}

export async function cancelAllQueuedMessages(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(authorizedFetch, `/agentic/queue/${encodeURIComponent(sessionId)}`, {
			method: 'DELETE',
			...(signal ? { signal } : {})
		})
	)
}

export async function continueQueuedMessages(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(authorizedFetch, `/agentic/queue/${encodeURIComponent(sessionId)}/continue`, {
			method: 'POST',
			...(signal ? { signal } : {})
		})
	)
}

export async function retryQueuedMessage(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string,
	signal?: AbortSignal
): Promise<QueueMutationResponse> {
	return decodeQueueMutationResponse(
		await llamaAIRequest<unknown>(
			authorizedFetch,
			`/agentic/queue/${encodeURIComponent(sessionId)}/${encodeURIComponent(messageId)}/retry`,
			{ method: 'POST', ...(signal ? { signal } : {}) }
		)
	)
}

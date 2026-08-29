import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'

export interface WebMobilePushStatus {
	available: boolean
	enabled: boolean
}

export const COMPLETION_SEEN_REQUEST_TIMEOUT_MS = 2_000

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeStatus(value: unknown): WebMobilePushStatus {
	if (!isRecord(value) || typeof value.available !== 'boolean' || typeof value.enabled !== 'boolean') {
		throw new Error('Invalid web mobile notification status')
	}
	return { available: value.available, enabled: value.enabled }
}

export async function getWebMobilePushStatus(
	authorizedFetch: AuthorizedFetch,
	signal?: AbortSignal
): Promise<WebMobilePushStatus> {
	return decodeStatus(await llamaAIRequest<unknown>(authorizedFetch, '/mobile-push/web-notifications', { signal }))
}

export async function setWebMobilePushEnabled(
	authorizedFetch: AuthorizedFetch,
	enabled: boolean
): Promise<WebMobilePushStatus> {
	return decodeStatus(
		await llamaAIRequest<unknown>(authorizedFetch, '/mobile-push/web-notifications', {
			method: 'PUT',
			json: { enabled }
		})
	)
}

export async function markWebCompletionSeen(
	authorizedFetch: AuthorizedFetch,
	sessionId: string,
	messageId: string
): Promise<boolean> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), COMPLETION_SEEN_REQUEST_TIMEOUT_MS)
	try {
		const value = await llamaAIRequest<unknown>(
			authorizedFetch,
			`/mobile-push/completions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/seen`,
			{ method: 'POST', keepalive: true, signal: controller.signal }
		)
		if (!isRecord(value) || value.ok !== true || typeof value.seen !== 'boolean') {
			throw new Error('Invalid completion seen response')
		}
		return value.seen
	} finally {
		clearTimeout(timeout)
	}
}

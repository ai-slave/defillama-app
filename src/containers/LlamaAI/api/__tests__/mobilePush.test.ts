import { describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import {
	getWebMobilePushStatus,
	markWebCompletionSeen,
	setWebMobilePushEnabled
} from '~/containers/LlamaAI/api/mobilePush'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})
}

describe('web mobile push API', () => {
	test('reads and updates the web notification preference', async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = []
		const fetcher: AuthorizedFetch = async (url, init) => {
			requests.push({ url, init })
			return jsonResponse({ available: true, enabled: init?.method === 'PUT' })
		}

		await expect(getWebMobilePushStatus(fetcher)).resolves.toEqual({ available: true, enabled: false })
		await expect(setWebMobilePushEnabled(fetcher, true)).resolves.toEqual({ available: true, enabled: true })

		expect(requests[0]).toEqual({ url: `${AI_SERVER}/mobile-push/web-notifications`, init: expect.any(Object) })
		expect(requests[1]?.url).toBe(`${AI_SERVER}/mobile-push/web-notifications`)
		expect(requests[1]?.init).toMatchObject({
			method: 'PUT',
			body: JSON.stringify({ enabled: true })
		})
	})

	test('marks the exact completed message seen with a keepalive request', async () => {
		let request: { url: string; init?: RequestInit } | null = null
		const fetcher: AuthorizedFetch = async (url, init) => {
			request = { url, init }
			return jsonResponse({ ok: true, seen: true })
		}

		await expect(markWebCompletionSeen(fetcher, 'session-1', 'message-1')).resolves.toBe(true)
		expect(request).toEqual({
			url: `${AI_SERVER}/mobile-push/completions/session-1/messages/message-1/seen`,
			init: expect.objectContaining({ method: 'POST', keepalive: true, signal: expect.any(AbortSignal) })
		})
	})

	test('aborts a stalled seen request before the backend grace period expires', async () => {
		vi.useFakeTimers()
		try {
			let requestSignal: AbortSignal | null = null
			const fetcher: AuthorizedFetch = (_url, init) =>
				new Promise<Response | null>((_resolve, reject) => {
					requestSignal = init?.signal ?? null
					requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason))
				})

			const request = markWebCompletionSeen(fetcher, 'session-1', 'message-1')
			const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' })
			await vi.advanceTimersByTimeAsync(2000)

			await rejection
			expect(requestSignal?.aborted).toBe(true)
		} finally {
			vi.useRealTimers()
		}
	})

	test('rejects malformed backend responses', async () => {
		const fetcher: AuthorizedFetch = async () => jsonResponse({ enabled: true })

		await expect(getWebMobilePushStatus(fetcher)).rejects.toThrow('Invalid web mobile notification status')
	})
})

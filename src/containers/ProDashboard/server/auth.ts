import type { IncomingMessage } from 'node:http'
import { POCKETBASE_URL } from '~/constants'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

export function getAuthTokenFromRequest(req: IncomingMessage & { cookies?: Record<string, string> }): string | null {
	return req.cookies?.['pb_auth_token'] || null
}

export function createServerAuthorizedFetch(token: string) {
	return async (url: string, options: RequestInit = {}): Promise<Response> => {
		return fetchWithPoolingOnServer(url, {
			...options,
			headers: {
				...options.headers,
				Authorization: `Bearer ${token}`
			}
		})
	}
}

export async function fetchAuthenticatedUserId(token: string): Promise<string | null> {
	try {
		const response = await fetchWithPoolingOnServer(`${POCKETBASE_URL}/api/collections/users/auth-refresh`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` }
		})
		if (!response.ok) return null

		const payload = (await response.json()) as { record?: { id?: unknown } }
		return typeof payload.record?.id === 'string' ? payload.record.id : null
	} catch {
		return null
	}
}

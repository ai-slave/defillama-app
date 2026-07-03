import { fetchJson } from '~/utils/async'
import { FORGD_PUBLIC_API_BASE } from './constants'

export type ForgdQuery = Record<string, string | number | undefined>

export function buildForgdUrl(path: string, query?: ForgdQuery): string {
	const url = new URL(`${FORGD_PUBLIC_API_BASE}${path}`)
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value != null && value !== '') url.searchParams.set(key, String(value))
		}
	}
	return url.toString()
}

export async function forgdFetch<T = unknown>(path: string, query?: ForgdQuery): Promise<T> {
	const key = process.env.API_KEY_FORGD
	if (!key) throw new Error('API_KEY_FORGD is not configured')
	return fetchJson<T>(buildForgdUrl(path, query), {
		timeout: 30_000,
		headers: { Authorization: `Bearer ${key}` }
	})
}

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
	const key = process.env.API_KEY_FORGD?.trim()
	const headers = key ? { Authorization: `Bearer ${key}` } : undefined
	return fetchJson<T>(buildForgdUrl(path, query), {
		timeout: 30_000,
		headers
	})
}

export async function forgdPost<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
	const key = process.env.API_KEY_FORGD?.trim()
	return fetchJson<T>(buildForgdUrl(path), {
		method: 'POST',
		timeout: 30_000,
		headers: {
			'Content-Type': 'application/json',
			...(key ? { Authorization: `Bearer ${key}` } : {})
		},
		body: JSON.stringify(body)
	})
}

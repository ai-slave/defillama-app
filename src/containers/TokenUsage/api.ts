import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { RawProtocolTokenUsageEntry } from './api.types'

const PROTOCOLS_BY_TOKEN_API_URL = `${SERVER_URL}/tokenProtocols`

export async function fetchProtocolsByToken(symbol: string): Promise<Array<RawProtocolTokenUsageEntry>> {
	if (!symbol) return []
	return fetchJson<Array<RawProtocolTokenUsageEntry>>(`${PROTOCOLS_BY_TOKEN_API_URL}/${symbol.toUpperCase()}`)
}

export async function fetchProtocolsByTokenClient(
	symbol: string,
	fetchFn: ((url: string) => Promise<Response | null>) | typeof fetch = fetch
): Promise<Array<RawProtocolTokenUsageEntry>> {
	if (!symbol) return []
	const res = await fetchFn(`/api/private/token-usage/${encodeURIComponent(symbol.toUpperCase())}`)
	if (!res) {
		throw new Error('Authentication required')
	}
	if (!res.ok) {
		const errorData = await res.json().catch(() => null)
		throw new Error(errorData?.error ?? `Couldn't load token protocols (status ${res.status}).`)
	}
	return res.json()
}

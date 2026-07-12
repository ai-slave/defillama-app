import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { IRawTokenRightsEntry } from './api.types'
import { findProtocolEntry } from './utils'

export async function fetchTokenRightsDataFromNetwork(): Promise<IRawTokenRightsEntry[]> {
	return fetchJson<IRawTokenRightsEntry[]>(`${SERVER_URL}/token-rights`).catch(() => {
		console.error('[token-rights] upstream request failed')
		return []
	})
}
export async function fetchTokenRightsEntryByDefillamaId(defillamaId: string): Promise<IRawTokenRightsEntry | null> {
	if (!defillamaId) {
		return null
	}

	const data = await fetchTokenRightsDataFromNetwork()
	return findProtocolEntry(data, defillamaId)
}

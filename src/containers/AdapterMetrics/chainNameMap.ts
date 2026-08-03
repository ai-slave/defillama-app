import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'

const DIMENSION_CHAIN_NAME_MAP_API = `${SERVER_URL}/overview/_internal/chain-name-id-map`

let chainNameMapPromise: Promise<Record<string, string> | null> | null = null

export function getDimensionChainNameMap(): Promise<Record<string, string> | null> {
	if (!chainNameMapPromise) {
		chainNameMapPromise = fetchJson<Record<string, string>>(DIMENSION_CHAIN_NAME_MAP_API)
			.catch((error) => {
				console.error('Failed to fetch the Dimensions chain-name map:', error)
				return null
			})
			.then((chainNameMap) => {
				if (chainNameMap === null) chainNameMapPromise = null
				return chainNameMap
			})
	}
	return chainNameMapPromise
}

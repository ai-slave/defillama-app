import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { RaisesApiResponse } from './api.types'
import { normalizeRaisesApiResponse, type Raise, type RaisesResponse } from './model'

const RAISES_CACHE_TTL_MS = 60_000

let raisesCache: {
	expiresAt: number
	value: Promise<RaisesResponse>
} | null = null

/** Raw transport fetch reserved for snapshot publication. App code should use `fetchRaisesFromNetwork`. */
export async function fetchRaisesApiResponse(): Promise<RaisesApiResponse> {
	return fetchJson<RaisesApiResponse>(`${SERVER_URL}/raises`)
}

/** Fetch fundraising rounds with all monetary values normalized to whole USD. */
export async function fetchRaisesFromNetwork(): Promise<RaisesResponse> {
	return normalizeRaisesApiResponse(await fetchRaisesApiResponse())
}

export async function fetchRaises(): Promise<RaisesResponse> {
	return fetchRaisesFromNetwork()
}

async function fetchRaisesWithShortCache(): Promise<RaisesResponse> {
	const now = Date.now()
	if (!raisesCache || raisesCache.expiresAt <= now) {
		const value = fetchRaisesFromNetwork().catch((error) => {
			if (raisesCache?.value === value) {
				raisesCache = null
			}
			throw error
		})

		raisesCache = {
			expiresAt: now + RAISES_CACHE_TTL_MS,
			value
		}
	}

	return raisesCache.value
}

export async function fetchRaisesByDefillamaId(defillamaId: string): Promise<Raise[]> {
	if (!defillamaId) {
		return []
	}

	const response = await fetchRaisesWithShortCache()
	return response.raises.filter((raise) => raise.defillamaId === defillamaId)
}

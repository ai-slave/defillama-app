import { VAULT_RISK_API } from '~/constants'
import { fetchJson } from '~/utils/async'

// Pool ids with vault-risk coverage, for the table-level "View risk data" shield.
// Coverage is sparse even within covered protocols, so the gate is per-pool: the
// risk server's vault list is the source of truth. The route is pro-key gated —
// without an API_KEY in env this resolves to an empty set and no shields render
// (never a dead link). Cached like the raises map (promise cache per TTL).
const CACHE_TTL_MS = 10 * 60 * 1000
let cached: { at: number; promise: Promise<Set<string>> } | null = null

async function fetchCoveredPoolIds(): Promise<Set<string>> {
	try {
		const body = await fetchJson<{ data?: Array<{ pool_id?: string }> }>(VAULT_RISK_API, { timeout: 10_000 })
		const ids = (Array.isArray(body?.data) ? body.data : [])
			.map((vault) => vault?.pool_id)
			.filter((id): id is string => typeof id === 'string' && id.length > 0)
		return new Set(ids)
	} catch {
		return new Set()
	}
}

export function getRiskCoveredPoolIds(): Promise<Set<string>> {
	const now = Date.now()
	if (!cached || now - cached.at > CACHE_TTL_MS) {
		cached = { at: now, promise: fetchCoveredPoolIds() }
	}
	return cached.promise
}

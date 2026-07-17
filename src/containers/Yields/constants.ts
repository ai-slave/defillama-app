import { YIELDS_V2_SERVER_URL } from '~/constants'

const YIELDS_BROWSER_HISTORY_PROXY_URL = '/api/public/yields/proxy'

// History fetchers run in both environments: browsers use the allowlisted proxy,
// while SSR and server jobs avoid an extra HTTP hop and call the upstream directly.
export function getYieldsHistoryUrl(path: string): string {
	return typeof window === 'undefined' ? `${YIELDS_V2_SERVER_URL}${path}` : `${YIELDS_BROWSER_HISTORY_PROXY_URL}${path}`
}

// Yields APIs
export const YIELD_EARN_DATASET_API = '/api/public/yields/earn'
export const YIELD_BORROW_MARKETS_DATASET_API = '/api/public/yields/borrow-markets'
export const YIELD_BORROW_ROUTES_DATASET_API = '/api/public/yields/borrow-routes'
export const YIELD_LOOPS_DATASET_API = '/api/public/yields/loops'

export const disclaimer =
	"DefiLlama doesn't audit nor endorse any of the protocols listed, we just focus on providing accurate data. Ape at your own risk."

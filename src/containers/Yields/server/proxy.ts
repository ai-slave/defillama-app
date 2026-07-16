import { YIELDS_V2_SERVER_URL } from '~/constants'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest } from '~/server/api/respond'
import type { ApiQuery } from '~/server/api/types'

const YIELDS_PROXY_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'
const YIELDS_PROXY_RESULT_TTL_MS = 5 * 60 * 1000
const HISTORY_RANGES = ['30d', '90d', 'max'] as const

export function buildYieldsProxyUrl(query: ApiQuery): string | null {
	const path = query.path
	if (!Array.isArray(path)) return null

	// This public route fronts a keyed upstream, so only browser-used history
	// endpoints are exposed.
	const isEarnHistory = path.length === 4 && path[0] === 'v2' && path[1] === 'earn' && path[2] && path[3] === 'history'
	const isBorrowHistory =
		path.length === 5 &&
		path[0] === 'v2' &&
		path[1] === 'borrow' &&
		path[2] === 'markets' &&
		path[3] &&
		path[4] === 'history'
	const isReferenceRatesHistory =
		path.length === 4 &&
		path[0] === 'v2' &&
		path[1] === 'reference-rates' &&
		path[2] === 'stablecoins' &&
		path[3] === 'history'
	const isProtocolMedianHistory =
		path.length === 4 && path[0] === 'v2' && path[1] === 'protocol-median' && path[2] && path[3] === 'history'

	if (!isEarnHistory && !isBorrowHistory && !isReferenceRatesHistory && !isProtocolMedianHistory) return null

	const range = queryString(query, 'range')
	if (range !== undefined && !HISTORY_RANGES.includes(range as (typeof HISTORY_RANGES)[number])) return null

	const searchParams = new URLSearchParams()
	if (range) searchParams.set('range', range)
	const qs = searchParams.toString()
	return `${YIELDS_V2_SERVER_URL}/${path.map(encodeURIComponent).join('/')}${qs ? `?${qs}` : ''}`
}

export const yieldsProxy = proxyJsonRoute({
	route: '/api/public/yields/proxy/[...path]',
	cacheControl: YIELDS_PROXY_CACHE_CONTROL,
	resultTtlMs: YIELDS_PROXY_RESULT_TTL_MS,
	upstreamUrl: (req) => buildYieldsProxyUrl(req.query) ?? badRequest('Invalid Yields proxy request'),
	upstreamErrorMessage: 'Failed to fetch upstream Yields data'
})

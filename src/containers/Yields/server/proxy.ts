import { YIELDS_V2_SERVER_URL } from '~/constants'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest } from '~/server/api/respond'
import type { ApiQuery } from '~/server/api/types'
import { YIELD_POOL_CONFIG_ID_REGEX } from '~/utils/regex-constants'
import { lockPoolDetail, lockPoolHistory } from '../data/verifiedGate'
import type { PoolDetail, PoolHistory } from '../poolDetail/types'

const YIELDS_PROXY_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'
const YIELDS_PROXY_RESULT_TTL_MS = 5 * 60 * 1000
const HISTORY_RANGES = ['30d', '90d', 'max'] as const

type EarnProxyShape = 'detail' | 'history'

/** Exact earn-detail shapes only: collection sub-resources must never masquerade as pool ids. */
function earnProxyShape(path: Array<string>): EarnProxyShape | null {
	if (path[0] !== 'v2' || path[1] !== 'earn' || !YIELD_POOL_CONFIG_ID_REGEX.test(path[2] ?? '')) return null
	if (path.length === 3) return 'detail'
	if (path.length === 4 && path[3] === 'history') return 'history'
	return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function buildYieldsProxyUrl(query: ApiQuery): string | null {
	const path = query.path
	if (!Array.isArray(path)) return null

	// This public route fronts a keyed upstream, so only the endpoints the browser
	// actually calls are exposed.
	const earnShape = earnProxyShape(path)
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

	if (!earnShape && !isBorrowHistory && !isReferenceRatesHistory && !isProtocolMedianHistory) return null

	const range = queryString(query, 'range')
	if (range !== undefined && !HISTORY_RANGES.includes(range as (typeof HISTORY_RANGES)[number])) return null

	const searchParams = new URLSearchParams()
	if (range) searchParams.set('range', range)
	const qs = searchParams.toString()
	return `${YIELDS_V2_SERVER_URL}/${path.map(encodeURIComponent).join('/')}${qs ? `?${qs}` : ''}`
}

// Public and CDN-cached, so redacted unconditionally; subscribers read the private route instead.
export const yieldsProxy = proxyJsonRoute({
	route: '/api/public/yields/proxy/[...path]',
	cacheControl: YIELDS_PROXY_CACHE_CONTROL,
	resultTtlMs: YIELDS_PROXY_RESULT_TTL_MS,
	upstreamUrl: (req) => buildYieldsProxyUrl(req.query) ?? badRequest('Invalid Yields proxy request'),
	transform: (payload, req) => redactYieldsProxyPayload(payload, req.query),
	upstreamErrorMessage: 'Failed to fetch upstream Yields data'
})

/** Only the two earn shapes carry measurements; other allowlisted paths pass through untouched. */
function redactYieldsProxyPayload(payload: unknown, query: ApiQuery): unknown {
	const path = query.path
	if (!Array.isArray(path)) return payload
	const shape = earnProxyShape(path)
	if (!shape || !isRecord(payload) || !('data' in payload)) return payload

	const body = payload as { data: unknown }
	if (shape === 'history') {
		return Array.isArray(body.data) ? { ...body, data: lockPoolHistory(body.data as PoolHistory) } : payload
	}
	if (shape === 'detail' && isRecord(body.data)) {
		return { ...body, data: lockPoolDetail(body.data as unknown as PoolDetail) }
	}
	return payload
}

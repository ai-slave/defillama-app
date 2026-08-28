import { EQUITIES_SERVER_URL } from '~/constants'
import { EQUITIES_PRICE_HISTORY_TIMEFRAMES } from '~/containers/Equities/api.types'
import { queryEnum, queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest } from '~/server/api/respond'
import type { ApiQuery } from '~/server/api/types'

const EQUITIES_PRICE_HISTORY_CACHE_CONTROL = 'public, s-maxage=1800, stale-while-revalidate=1800'
const EQUITIES_PRICE_HISTORY_RESULT_TTL_MS = 30 * 60 * 1000

export function buildEquitiesPriceHistoryUpstreamUrl(query: ApiQuery): string | null {
	const ticker = queryString(query, 'ticker')
	const country = queryString(query, 'country')
	const timeframe = queryEnum(query, 'timeframe', EQUITIES_PRICE_HISTORY_TIMEFRAMES)
	if (!ticker || !country || !timeframe) return null

	const url = new URL(`${EQUITIES_SERVER_URL}/price-history`)
	url.searchParams.set('ticker', ticker)
	url.searchParams.set('country', country)
	url.searchParams.set('timeframe', timeframe)
	url.searchParams.set('zz', '16')
	return url.toString()
}

export const equitiesPriceHistoryProxy = proxyJsonRoute({
	route: '/api/public/equities/price-history',
	cacheControl: EQUITIES_PRICE_HISTORY_CACHE_CONTROL,
	resultTtlMs: EQUITIES_PRICE_HISTORY_RESULT_TTL_MS,
	upstreamUrl: (req) =>
		buildEquitiesPriceHistoryUpstreamUrl(req.query) ?? badRequest('Invalid equities price history request'),
	upstreamErrorMessage: 'Failed to fetch upstream equities price history'
})

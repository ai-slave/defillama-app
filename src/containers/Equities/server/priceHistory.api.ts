import { EQUITIES_SERVER_URL } from '~/constants'
import { toEquitiesPriceHistoryApiTimeframe } from '~/containers/Equities/priceHistoryTimeframes'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest } from '~/server/api/respond'
import type { ApiQuery } from '~/server/api/types'
import { parsePriceChartTimeframe } from '~/utils/priceChartTimeframes'

const EQUITIES_PRICE_HISTORY_CACHE_CONTROL = 'public, s-maxage=1800, stale-while-revalidate=1800'
const EQUITIES_PRICE_HISTORY_RESULT_TTL_MS = 30 * 60 * 1000

export function buildEquitiesPriceHistoryUpstreamUrl(query: ApiQuery): string | null {
	const ticker = queryString(query, 'ticker')
	const country = queryString(query, 'country')
	const timeframe = parsePriceChartTimeframe(queryString(query, 'timeframe'))
	if (!ticker || !country || !timeframe) return null

	const url = new URL(`${EQUITIES_SERVER_URL}/price-history`)
	url.searchParams.set('ticker', ticker)
	url.searchParams.set('country', country)
	url.searchParams.set('timeframe', toEquitiesPriceHistoryApiTimeframe(timeframe))
	url.searchParams.set('cachebust', '091626')
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

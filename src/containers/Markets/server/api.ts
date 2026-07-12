import { MARKETS_SERVER_URL } from '~/constants'
import { isHttpNotFoundMessage, MARKETS_CACHE_CONTROL } from '~/server/api/common'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest, notFound, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { resolveMarketsExchangeByParam } from './dataset.server'
import { fetchExchangeMarketsFromNetwork } from './upstream'

const MARKETS_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000

export const tokenMarkets = proxyJsonRoute({
	route: '/api/public/markets/[token]',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: (req) => {
		const token = queryString(req.query, 'token')
		if (!token) {
			return badRequest('Missing token')
		}

		return `${MARKETS_SERVER_URL}/tokens/${encodeURIComponent(token.toLowerCase())}.json`
	},
	onError: (error) => (isHttpNotFoundMessage(error) ? notFound('Token not found') : null),
	upstreamErrorMessage: 'Failed to load token markets'
})

export const tokenMarketsList = proxyJsonRoute({
	route: '/api/public/markets/tokens',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: () => `${MARKETS_SERVER_URL}/tokens/list.json`,
	upstreamErrorMessage: 'Failed to load token markets list'
})

export const marketCategoriesList = proxyJsonRoute({
	route: '/api/public/markets/categories',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: () => `${MARKETS_SERVER_URL}/categories/list.json`,
	upstreamErrorMessage: 'Failed to load market categories list'
})

export const marketCategorySeries = proxyJsonRoute({
	route: '/api/public/markets/categories/series',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: () => `${MARKETS_SERVER_URL}/categories/series.json`,
	upstreamErrorMessage: 'Failed to load market category series'
})

export const marketCategory = proxyJsonRoute({
	route: '/api/public/markets/categories/[category]',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: (req) => {
		const category = queryString(req.query, 'category')
		if (!category) return badRequest('Missing category')
		return `${MARKETS_SERVER_URL}/categories/${encodeURIComponent(category.toLowerCase())}.json`
	},
	onError: (error) => (isHttpNotFoundMessage(error) ? notFound('Category not found') : null),
	upstreamErrorMessage: 'Failed to load category markets'
})

export const marketExchangesList = proxyJsonRoute({
	route: '/api/public/markets/exchanges',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: () => `${MARKETS_SERVER_URL}/exchanges/list.json`,
	upstreamErrorMessage: 'Failed to load exchanges list'
})

export const marketExchangeSeries = proxyJsonRoute({
	route: '/api/public/markets/exchanges/series',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MARKETS_RESPONSE_CACHE_TTL_MS,
	upstreamUrl: () => `${MARKETS_SERVER_URL}/exchanges/series.json`,
	upstreamErrorMessage: 'Failed to load exchange series'
})

export const exchangeMarkets = defineApiRoute({
	route: '/api/public/markets/exchanges/[exchange]',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async (req) => {
		const exchange = queryString(req.query, 'exchange')
		if (!exchange) {
			return badRequest('Missing exchange')
		}

		try {
			const marketsExchange = await resolveMarketsExchangeByParam(exchange)
			if (!marketsExchange) {
				return notFound('Exchange not found')
			}

			const data = await cachedJsonResult(
				'/api/public/markets/exchanges/[exchange]',
				marketsExchange,
				{ ttlMs: MARKETS_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
				() => fetchExchangeMarketsFromNetwork(marketsExchange)
			)
			return okSerializedJson(data)
		} catch (error) {
			if (isHttpNotFoundMessage(error)) {
				return notFound('Exchange not found')
			}
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load exchange markets')
		}
	}
})

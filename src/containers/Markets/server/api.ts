import { MARKETS_SERVER_URL } from '~/constants'
import { isHttpNotFoundMessage, MARKETS_CACHE_CONTROL } from '~/server/api/common'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest, notFound } from '~/server/api/respond'

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

		const normalizedToken = token.toLowerCase()
		// Once the static category/exchange APIs are removed, these top-level paths
		// would otherwise fall through to the dynamic [token] route.
		if (normalizedToken === 'categories' || normalizedToken === 'exchanges') {
			return notFound('Token not found')
		}

		return `${MARKETS_SERVER_URL}/tokens/${encodeURIComponent(normalizedToken)}.json`
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

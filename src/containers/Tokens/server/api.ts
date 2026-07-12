import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { getTokensPageData } from '../queries.server'

const TOKENS_RESPONSE_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600'

export const tokensDataset = defineApiRoute({
	route: '/api/public/tokens',
	cacheControl: TOKENS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			return ok(await getTokensPageData(req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch tokens data')
		}
	}
})

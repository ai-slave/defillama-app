import { getCorrelationTokenOptionsFromQuery } from '~/containers/Correlations/queries'
import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'

const CORRELATION_TOKENS_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600'

export const correlationTokens = defineApiRoute({
	route: '/api/public/correlation/tokens',
	cacheControl: CORRELATION_TOKENS_CACHE_CONTROL,
	handle: async (req) => {
		try {
			return ok(await getCorrelationTokenOptionsFromQuery(req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch correlation tokens')
		}
	}
})

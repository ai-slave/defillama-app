import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { getTokensCacheControl } from '../cache.server'
import { getTokensChartSnapshot, getTokensPageSnapshot } from '../queries.server'

export const tokensDataset = defineApiRoute({
	route: '/api/public/tokens',
	handle: async (req) => {
		try {
			const snapshot = await getTokensPageSnapshot(req.query)
			return ok(snapshot.data, { 'Cache-Control': getTokensCacheControl(snapshot.generatedAt) })
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch tokens data')
		}
	}
})

export const tokensMarketMapDataset = defineApiRoute({
	route: '/api/public/tokens/market-map',
	handle: async (req) => {
		try {
			const snapshot = await getTokensChartSnapshot(req.query)
			return ok(snapshot.data, { 'Cache-Control': getTokensCacheControl(snapshot.generatedAt) })
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch tokens market map data')
		}
	}
})

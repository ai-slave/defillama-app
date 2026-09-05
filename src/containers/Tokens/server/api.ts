import { badRequest, ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { isContentHashVersion } from '~/server/datasetSnapshots/redisBlobStore.server'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { getTokensCacheControl } from '../cache.server'
import { getTokensChartSnapshot, getTokensPageSnapshot, TokensExportSnapshotUnavailableError } from '../queries.server'

export const tokensDataset = defineApiRoute({
	route: '/api/public/tokens',
	handle: async (req) => {
		const version = req.query.snapshot
		if (
			version !== undefined &&
			(typeof version !== 'string' || (version !== 'latest' && !isContentHashVersion(version)))
		) {
			return badRequest('Invalid Tokens export snapshot')
		}
		try {
			const snapshot = await getTokensPageSnapshot(req.query)
			return ok(snapshot.data, {
				'Cache-Control': version ? 'private, no-store' : getTokensCacheControl(snapshot.generatedAt)
			})
		} catch (error) {
			if (error instanceof TokensExportSnapshotUnavailableError)
				return { status: 503, body: { error: error.message }, headers: { 'Cache-Control': 'private, no-store' } }
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

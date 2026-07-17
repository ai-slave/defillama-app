import { MARKETS_SERVER_URL } from '~/constants'
import { MARKETS_CACHE_CONTROL } from '~/server/api/common'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult, cachedResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { mapMasterDirectoryOverview } from '../master.mappers'
import { MASTER_CHART_PARTS, type MasterChartPart, type MasterColumnarSeriesResponse } from '../master.types'
import { isCanonicalExchangeSlug } from '../slugs'
import { fetchMasterExchangeHistoryFromNetwork, fetchMasterExchangeSeriesFromNetwork } from './master.upstream'

const MASTER_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000
const MASTER_CHART_TIMEOUT_MS = 60_000

const getCachedMasterExchangeSeries = () =>
	cachedResult<MasterColumnarSeriesResponse>(
		'exchanges-master-series-source',
		`${MARKETS_SERVER_URL}/exchanges/series.json`,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		fetchMasterExchangeSeriesFromNetwork
	)

const getCachedMasterExchangeHistory = (exchange: string) =>
	cachedResult<MasterColumnarSeriesResponse>(
		`exchanges-master-history-source:${exchange}`,
		`${MARKETS_SERVER_URL}/exchanges/${encodeURIComponent(exchange)}/series.json`,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		() => fetchMasterExchangeHistoryFromNetwork(exchange)
	)

export const masterExchangeSeries = defineApiRoute({
	route: '/api/public/exchanges/series',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async () => {
		try {
			const payload = await cachedJsonResult(
				'exchanges-master-series-response',
				'global',
				{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
				getCachedMasterExchangeSeries
			)
			return okSerializedJson(payload)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load exchange series')
		}
	}
})

export const masterExchangeHistory = defineApiRoute({
	route: '/api/public/exchanges/[exchange]/history',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async (req) => {
		const exchange = queryString(req.query, 'exchange')
		if (!exchange) return badRequest('Missing exchange')
		if (!isCanonicalExchangeSlug(exchange)) return badRequest('Invalid exchange')
		try {
			const payload = await cachedJsonResult(
				'exchanges-master-profile-history',
				exchange,
				{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
				async () => mapMasterDirectoryOverview(await getCachedMasterExchangeHistory(exchange))
			)
			return okSerializedJson(payload)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load exchange history')
		}
	}
})

export const masterExchangeChart = proxyJsonRoute({
	route: '/api/public/exchanges/charts/[part]',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MASTER_RESPONSE_CACHE_TTL_MS,
	timeoutMs: MASTER_CHART_TIMEOUT_MS,
	upstreamUrl: (req) => {
		const part = queryString(req.query, 'part') as MasterChartPart | null
		if (!part || !MASTER_CHART_PARTS.includes(part)) return badRequest('Unknown exchange chart')
		return `${MARKETS_SERVER_URL}/charts/${part}.json`
	},
	upstreamErrorMessage: 'Failed to load exchange chart'
})

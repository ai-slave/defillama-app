import { queryString } from '~/server/api/params'
import { badRequest, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { forgdFetch } from './client'
import { MM_CACHE_CONTROL, MM_RESULT_TTL_MS } from './constants'

const MM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

const pick = (v: string | Array<string> | undefined) => (Array.isArray(v) ? v[0] : v)

function dateParams(query: Record<string, string | Array<string> | undefined>) {
	return { start_date: pick(query.start_date) || undefined, end_date: pick(query.end_date) || undefined }
}

function leaderboardRoute(route: string, forgdPath: string) {
	return defineApiRoute({
		route,
		cacheControl: MM_CACHE_CONTROL,
		handle: async (req) => {
			const params = dateParams(req.query)
			try {
				const body = await cachedJsonResult(
					route,
					JSON.stringify([params.start_date ?? null, params.end_date ?? null]),
					{ ttlMs: MM_RESULT_TTL_MS, ttlJitter: 0.2 },
					() => forgdFetch(forgdPath, params)
				)
				return okSerializedJson(body)
			} catch (error) {
				recordRouteRuntimeError(error, 'apiRoute')
				return upstreamError('Failed to load market maker leaderboard')
			}
		}
	})
}

export const leaderboardPerformance = leaderboardRoute(
	'/api/public/market-makers/performance',
	'/market-maker/leaderboard/performance'
)
export const leaderboardAggregated = leaderboardRoute(
	'/api/public/market-makers/aggregated',
	'/market-maker/leaderboard/aggregated'
)
export const leaderboardDepth = leaderboardRoute('/api/public/market-makers/depth', '/market-maker/leaderboard/depth')
export const leaderboardVolume = leaderboardRoute(
	'/api/public/market-makers/volume',
	'/market-maker/leaderboard/volume'
)
export const leaderboardSpread = leaderboardRoute(
	'/api/public/market-makers/spread',
	'/market-maker/leaderboard/spread'
)
export const leaderboardKpi = leaderboardRoute('/api/public/market-makers/kpi', '/market-maker/leaderboard/kpi')

export const marketMakerDetails = defineApiRoute({
	route: '/api/public/market-makers/details',
	cacheControl: MM_CACHE_CONTROL,
	handle: async () => {
		try {
			const body = await cachedJsonResult(
				'/api/public/market-makers/details',
				'/api/public/market-makers/details',
				{
					ttlMs: MM_RESULT_TTL_MS,
					ttlJitter: 0.2
				},
				() => forgdFetch('/market-maker/details')
			)
			return okSerializedJson(body)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load market maker details')
		}
	}
})

function marketMakerByIdRoute(route: string, buildUpstream: (id: string) => string, includeDateParams: boolean) {
	return defineApiRoute({
		route,
		cacheControl: MM_CACHE_CONTROL,
		handle: async (req) => {
			const id = queryString(req.query, 'id')
			if (!id || !MM_ID_PATTERN.test(id)) {
				return badRequest('Invalid market maker id')
			}
			const params = includeDateParams ? dateParams(req.query) : undefined
			try {
				const body = await cachedJsonResult(
					route,
					JSON.stringify([id, params?.start_date ?? null, params?.end_date ?? null]),
					{ ttlMs: MM_RESULT_TTL_MS, ttlJitter: 0.2 },
					() => forgdFetch(buildUpstream(id), params)
				)
				return okSerializedJson(body)
			} catch (error) {
				recordRouteRuntimeError(error, 'apiRoute')
				return upstreamError('Failed to load market maker details')
			}
		}
	})
}

export const marketMakerDetail = marketMakerByIdRoute(
	'/api/public/market-makers/details/[id]',
	(id) => `/market-maker/details/${id}`,
	false
)
export const marketMakerBreakdown = marketMakerByIdRoute(
	'/api/public/market-makers/breakdown/[id]',
	(id) => `/market-maker/leaderboard/breakdown/${id}`,
	true
)
export const marketMakerPerformanceDetail = marketMakerByIdRoute(
	'/api/public/market-makers/performance/[id]',
	(id) => `/market-maker/leaderboard/performance/${id}`,
	true
)

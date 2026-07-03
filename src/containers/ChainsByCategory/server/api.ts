import { getChainsByCategoryChartData } from '~/containers/ChainsByCategory/queries'
import { PAGE_DATA_RESULT_TTL_MS } from '~/server/api/common'
import { okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { PAGE_DATA_CACHE_CONTROL } from '~/server/pageData/cache'
import { getCommaSeparatedQueryParam, getFirstQueryParam } from '~/server/pageData/query'
import { recordRouteRuntimeError } from '~/utils/telemetry'

export const chainsCharts = defineApiRoute({
	route: '/api/public/page-data/chains/charts',
	cacheControl: PAGE_DATA_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const category = getFirstQueryParam(req.query.category) ?? 'All'
			const sampledChart = getFirstQueryParam(req.query.sampledChart) === 'true'
			const extraTvlTypes = getCommaSeparatedQueryParam(req.query.extraTvlTypes)
			const cacheKey = JSON.stringify([category, sampledChart, extraTvlTypes])
			const body = await cachedJsonResult(
				'page-data-chains-charts',
				cacheKey,
				{ ttlMs: PAGE_DATA_RESULT_TTL_MS, ttlJitter: 0.2 },
				async () => {
					const data = await getChainsByCategoryChartData({
						category,
						sampledChart,
						extraTvlTypes
					})
					return {
						tvlChartsByChain: data.tvlChartsByChain,
						totalTvlByDate: data.totalTvlByDate
					}
				}
			)
			return okSerializedJson(body)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch chains chart data')
		}
	}
})

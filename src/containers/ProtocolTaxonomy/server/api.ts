import { getProtocolsCategoriesChartData } from '~/containers/ProtocolTaxonomy/queries'
import { PAGE_DATA_RESULT_TTL_MS } from '~/server/api/common'
import { okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { PAGE_DATA_CACHE_CONTROL } from '~/server/pageData/cache'
import { getCommaSeparatedQueryParam } from '~/server/pageData/query'
import { recordRouteRuntimeError } from '~/utils/telemetry'

export const categoriesCharts = defineApiRoute({
	route: '/api/public/page-data/categories/charts',
	cacheControl: PAGE_DATA_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const extraTvlTypes = getCommaSeparatedQueryParam(req.query.extraTvlTypes)
			const chartData = await cachedJsonResult(
				'page-data-categories-charts',
				JSON.stringify(extraTvlTypes),
				{ ttlMs: PAGE_DATA_RESULT_TTL_MS, ttlJitter: 0.2 },
				() =>
					getProtocolsCategoriesChartData({
						extraTvlTypes
					})
			)
			return okSerializedJson(chartData)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch categories chart data')
		}
	}
})

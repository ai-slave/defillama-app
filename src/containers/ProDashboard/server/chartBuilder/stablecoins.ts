import { normalizeCacheList } from '~/server/api/cacheKey'
import { queryFilterMode, queryList, queryString } from '~/server/api/params'
import { badRequest, okSerializedJson } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { normalizeLegacyChartBuilderChains } from './filters'
import { getChartBuilderSeriesLimit, validateChartBuilderFilters } from './requestLimits'
import { getCachedStablecoinChainBreakdown } from './stablecoinData'

const BREAKDOWN_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=1200'

export const stablecoinByChainBreakdown = defineApiRoute({
	route: '/api/public/pro-dashboard/chart-builder/stablecoins/breakdowns/by-chain',
	cacheControl: BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const protocol = queryString(req.query, 'protocol')
		if (protocol && protocol.toLowerCase() !== 'all') {
			return badRequest('stablecoins metric is only available when protocol=All')
		}

		const chains = normalizeLegacyChartBuilderChains(queryList(req.query, 'chains'))
		const chainCategories = normalizeCacheList(queryList(req.query, 'chainCategories'))
		const chainMode = queryFilterMode(req.query, 'chainFilterMode', 'filterMode')
		const chainCategoryMode = queryFilterMode(req.query, 'chainCategoryFilterMode', 'filterMode')
		const topN = getChartBuilderSeriesLimit(req.query, 5)
		const validationError = validateChartBuilderFilters({ chains, chainCategories, protocol })
		if (validationError) return badRequest(validationError)

		try {
			const result = await getCachedStablecoinChainBreakdown({
				chains,
				topN,
				chainFilterMode: chainMode,
				chainCategoryFilterMode: chainCategoryMode,
				chainCategories
			})
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return {
				status: 500,
				body: {
					error: 'Failed to fetch stablecoin chain data',
					details: error instanceof Error ? error.message : 'Unknown error'
				}
			}
		}
	}
})

import { normalizeCacheList } from '~/server/api/cacheKey'
import { queryFilterMode, queryIntClamped, queryList, queryString } from '~/server/api/params'
import { badRequest, okSerializedJson } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { getCachedChainNativeBreakdown, isChainNativeBreakdownMetric } from './chainNativeData'
import { normalizeLegacyChartBuilderChains } from './filters'
import { validateChartBuilderFilters } from './requestLimits'

const BREAKDOWN_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=1200'

export const chainNativeByChainBreakdown = defineApiRoute({
	route: '/api/public/pro-dashboard/chart-builder/chains/breakdowns/by-chain/[metric]',
	cacheControl: BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const metric = queryString(req.query, 'metric') ?? ''
		if (!isChainNativeBreakdownMetric(metric)) {
			return badRequest(`Unsupported metric: ${metric}`)
		}
		const protocol = queryString(req.query, 'protocol')
		if (protocol && protocol.toLowerCase() !== 'all') {
			return badRequest(`${metric} metric is only available when protocol=All`)
		}

		const chains = normalizeLegacyChartBuilderChains(queryList(req.query, 'chains'))
		const chainCategories = normalizeCacheList(queryList(req.query, 'chainCategories'))
		const chainMode = queryFilterMode(req.query, 'chainFilterMode', 'filterMode')
		const chainCategoryMode = queryFilterMode(req.query, 'chainCategoryFilterMode', 'filterMode')
		const topN = queryIntClamped(req.query, 'limit', 5, 1, 20)
		const validationError = validateChartBuilderFilters({ chains, chainCategories, protocol })
		if (validationError) return badRequest(validationError)

		try {
			const result = await getCachedChainNativeBreakdown({
				metric,
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
					error: 'Failed to fetch chain breakdown data',
					details: error instanceof Error ? error.message : 'Unknown error'
				}
			}
		}
	}
})

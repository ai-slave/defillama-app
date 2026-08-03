import { normalizeCacheList } from '~/server/api/cacheKey'
import { queryBoolean, queryFilterMode, queryIntClamped, queryList, queryString } from '~/server/api/params'
import { badRequest, okSerializedJson } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { normalizeLegacyChartBuilderChains } from './filters'
import { getCachedProtocolTvlBreakdown, getCachedProtocolTvlChainBreakdown } from './protocols/data'
import { validateCategoryChainFanOut, validateChartBuilderFilters } from './requestLimits'

const BREAKDOWN_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=1200'

export const protocolTvlBreakdown = defineApiRoute({
	route: '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/tvl',
	cacheControl: BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const topN = queryIntClamped(req.query, 'limit', 10, 1, 20)
		const categories = normalizeCacheList(queryList(req.query, 'categories'), { lowercase: true })
		const groupByParent = queryBoolean(req.query, 'groupByParent')
		const chainMode = queryFilterMode(req.query, 'chainFilterMode', 'filterMode')
		const categoryMode = queryFilterMode(req.query, 'categoryFilterMode', 'filterMode')

		const chains = normalizeLegacyChartBuilderChains(queryList(req.query, 'chains'))
		const validationError =
			validateChartBuilderFilters({ chains, categories }) ?? validateCategoryChainFanOut(categories, chains)
		if (validationError) return badRequest(validationError)

		try {
			const result = await getCachedProtocolTvlBreakdown({
				chains,
				categories,
				topN,
				groupByParent,
				chainFilterMode: chainMode,
				categoryFilterMode: categoryMode
			})
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return {
				status: 500,
				body: { error: 'Failed to fetch TVL data', message: error instanceof Error ? error.message : 'Unknown error' }
			}
		}
	}
})

export const protocolTvlByChainBreakdown = defineApiRoute({
	route: '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/by-chain/tvl',
	cacheControl: BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const chains = normalizeLegacyChartBuilderChains(queryList(req.query, 'chains'))
		const chainCategories = normalizeCacheList(queryList(req.query, 'chainCategories'))
		const chainMode = queryFilterMode(req.query, 'chainFilterMode', 'filterMode')
		const chainCategoryMode = queryFilterMode(req.query, 'chainCategoryFilterMode', 'filterMode')
		const topN = queryIntClamped(req.query, 'limit', 5, 1, 20)
		const protocol = queryString(req.query, 'protocol')
		const validationError = validateChartBuilderFilters({ chains, chainCategories, protocol })
		if (validationError) return badRequest(validationError)

		try {
			const result = await getCachedProtocolTvlChainBreakdown({
				...(protocol ? { protocol } : {}),
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
					error: 'Failed to fetch protocol chain data',
					details: error instanceof Error ? error.message : 'Unknown error'
				}
			}
		}
	}
})

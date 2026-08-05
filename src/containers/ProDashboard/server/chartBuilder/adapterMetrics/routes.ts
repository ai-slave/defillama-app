import { normalizeCacheList } from '~/server/api/cacheKey'
import { queryBoolean, queryFilterMode, queryList, queryString } from '~/server/api/params'
import { badRequest, okSerializedJson } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { normalizeLegacyChartBuilderChains } from '../filters'
import { getChartBuilderSeriesLimit, validateChartBuilderFilters } from '../requestLimits'
import { parseAdapterChartBuilderMetric } from './breakdowns/config'
import { getCachedAdapterMetricChainBreakdown, getCachedAdapterMetricProtocolBreakdown } from './data'

const BREAKDOWN_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=1200'

export const adapterMetricBreakdown = defineApiRoute({
	route: '/api/public/pro-dashboard/chart-builder/adapter-metrics/breakdowns/[metric]',
	cacheControl: BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const metricParam = queryString(req.query, 'metric') ?? ''
		const topN = getChartBuilderSeriesLimit(req.query, 10)
		const categories = normalizeCacheList(queryList(req.query, 'categories'), { lowercase: true })
		const groupByParent = queryBoolean(req.query, 'groupByParent')
		const chainMode = queryFilterMode(req.query, 'chainFilterMode', 'filterMode')
		const categoryMode = queryFilterMode(req.query, 'categoryFilterMode', 'filterMode')

		const metric = parseAdapterChartBuilderMetric(metricParam)
		if (!metric) {
			return badRequest(`Unsupported metric: ${metricParam}`)
		}

		const chains = normalizeLegacyChartBuilderChains(queryList(req.query, 'chains'))
		const validationError = validateChartBuilderFilters({ chains, categories })
		if (validationError) return badRequest(validationError)

		try {
			const result = await getCachedAdapterMetricProtocolBreakdown({
				metric,
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
				body: {
					error: `Failed to fetch protocol ${metric} data`,
					details: error instanceof Error ? error.message : 'Unknown error'
				}
			}
		}
	}
})

export const adapterMetricByChainBreakdown = defineApiRoute({
	route: '/api/public/pro-dashboard/chart-builder/adapter-metrics/breakdowns/by-chain/[metric]',
	cacheControl: BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const metricParam = queryString(req.query, 'metric') ?? ''
		const protocol = queryString(req.query, 'protocol')

		const metric = parseAdapterChartBuilderMetric(metricParam)
		if (!metric) {
			return badRequest(`Unsupported metric: ${metricParam}`)
		}

		const chains = normalizeLegacyChartBuilderChains(queryList(req.query, 'chains'))
		const chainCategories = normalizeCacheList(queryList(req.query, 'chainCategories'))
		const protocolCategories = normalizeCacheList(queryList(req.query, 'protocolCategories'), { lowercase: true })
		const chainMode = queryFilterMode(req.query, 'chainFilterMode', 'filterMode')
		const chainCategoryMode = queryFilterMode(req.query, 'chainCategoryFilterMode', 'filterMode')
		const protocolCategoryMode = queryFilterMode(req.query, 'protocolCategoryFilterMode', 'filterMode')
		const topN = getChartBuilderSeriesLimit(req.query, 5)
		const validationError = validateChartBuilderFilters({
			chains,
			chainCategories,
			protocolCategories,
			protocol
		})
		if (validationError) return badRequest(validationError)

		try {
			const result = await getCachedAdapterMetricChainBreakdown({
				...(protocol ? { protocol } : {}),
				metric,
				chains,
				topN,
				chainFilterMode: chainMode,
				chainCategoryFilterMode: chainCategoryMode,
				protocolCategoryFilterMode: protocolCategoryMode,
				chainCategories,
				protocolCategories
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

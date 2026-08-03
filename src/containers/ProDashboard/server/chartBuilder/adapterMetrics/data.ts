import { normalizeCacheList, stableCacheKey } from '~/server/api/cacheKey'
import { timeApiRoutePhase } from '~/server/api/phaseTelemetry'
import { cachedJsonResult, type CachedJsonPayload } from '~/server/api/resultCache'
import type { ProtocolBreakdownData, ProtocolChainData } from '~/utils/breakdowns'
import { getAdapterMetricChainSeries } from './breakdowns/chainSeries'
import type { AdapterChartBuilderMetric } from './breakdowns/config'
import { getAdapterMetricProtocolSeries } from './breakdowns/protocolSeries'

const BREAKDOWN_RESULT_TTL_MS = 10 * 60 * 1000
const BREAKDOWN_STALE_MS = 20 * 60 * 1000

interface AdapterMetricProtocolBreakdownRequest {
	metric: AdapterChartBuilderMetric
	chains: string[]
	categories: string[]
	topN: number
	groupByParent: boolean
	chainFilterMode: 'include' | 'exclude'
	categoryFilterMode: 'include' | 'exclude'
}

export function getCachedAdapterMetricProtocolBreakdown({
	metric,
	chains,
	categories,
	topN,
	groupByParent,
	chainFilterMode,
	categoryFilterMode
}: AdapterMetricProtocolBreakdownRequest): Promise<CachedJsonPayload<ProtocolBreakdownData>> {
	const chainsOrAll = chains.length > 0 ? chains : ['all']
	const normalizedCategories = normalizeCacheList(categories, { lowercase: true })
	const cacheKey = stableCacheKey([
		metric,
		chainsOrAll,
		normalizedCategories,
		topN,
		groupByParent,
		chainFilterMode,
		categoryFilterMode
	])
	return cachedJsonResult(
		'adapter-metrics-breakdown-dimensions',
		cacheKey,
		{ ttlMs: BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2, staleWhileRevalidateMs: BREAKDOWN_STALE_MS },
		() =>
			timeApiRoutePhase('adapter_protocol_breakdown_compute', () =>
				getAdapterMetricProtocolSeries({
					metric,
					chains: chainsOrAll,
					categories: normalizedCategories,
					topN,
					groupByParent,
					chainFilterMode,
					categoryFilterMode
				})
			)
	)
}

interface AdapterMetricChainBreakdownRequest {
	protocol?: string
	metric: AdapterChartBuilderMetric
	chains: string[]
	topN: number
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	protocolCategoryFilterMode: 'include' | 'exclude'
	chainCategories: string[]
	protocolCategories: string[]
}

export function getCachedAdapterMetricChainBreakdown({
	protocol,
	metric,
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	protocolCategoryFilterMode,
	chainCategories,
	protocolCategories
}: AdapterMetricChainBreakdownRequest): Promise<CachedJsonPayload<ProtocolChainData>> {
	const cacheKey = stableCacheKey([
		protocol ?? 'all',
		metric,
		chains,
		topN,
		chainFilterMode,
		chainCategoryFilterMode,
		protocolCategoryFilterMode,
		chainCategories,
		protocolCategories
	])
	return cachedJsonResult(
		'adapter-metrics-breakdown-chain',
		cacheKey,
		{ ttlMs: BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2, staleWhileRevalidateMs: BREAKDOWN_STALE_MS },
		() =>
			timeApiRoutePhase('adapter_chain_breakdown_compute', () =>
				getAdapterMetricChainSeries({
					...(protocol ? { protocol } : {}),
					metric,
					chains,
					topN,
					chainFilterMode,
					chainCategoryFilterMode,
					protocolCategoryFilterMode,
					chainCategories,
					protocolCategories
				})
			)
	)
}

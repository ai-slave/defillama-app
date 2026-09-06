import { cachedJsonResult, type CachedJsonPayload } from '~/server/api/resultCache'
import type { ProtocolBreakdownData, ProtocolChainData } from '~/utils/breakdowns'
import { getProtocolChainBreakdownData } from './breakdowns/byChain'
import { getTvlBreakdownData } from './breakdowns/tvl'

const BREAKDOWN_RESULT_TTL_MS = 10 * 60 * 1000

interface ProtocolTvlBreakdownRequest {
	chains: Array<string>
	categories: Array<string>
	topN: number
	groupByParent: boolean
	chainFilterMode: 'include' | 'exclude'
	categoryFilterMode: 'include' | 'exclude'
}

export function getCachedProtocolTvlBreakdown({
	chains,
	categories,
	topN,
	groupByParent,
	chainFilterMode,
	categoryFilterMode
}: ProtocolTvlBreakdownRequest): Promise<CachedJsonPayload<ProtocolBreakdownData>> {
	const cacheKey = JSON.stringify([chains, categories, topN, groupByParent, chainFilterMode, categoryFilterMode])
	return cachedJsonResult('protocols-breakdown-tvl', cacheKey, { ttlMs: BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2 }, () =>
		getTvlBreakdownData(chains, categories, topN, groupByParent, chainFilterMode, categoryFilterMode)
	)
}

interface ProtocolTvlChainBreakdownRequest {
	protocol?: string
	chains: Array<string>
	topN: number
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	chainCategories: Array<string>
}

export function getCachedProtocolTvlChainBreakdown({
	protocol,
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	chainCategories
}: ProtocolTvlChainBreakdownRequest): Promise<CachedJsonPayload<ProtocolChainData>> {
	const cacheKey = JSON.stringify([
		protocol ?? 'all',
		'tvl',
		chains,
		topN,
		chainFilterMode,
		chainCategoryFilterMode,
		chainCategories
	])
	return cachedJsonResult(
		'protocols-breakdown-chain-tvl',
		cacheKey,
		{ ttlMs: BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2 },
		() =>
			getProtocolChainBreakdownData({
				...(protocol ? { protocol } : {}),
				metric: 'tvl',
				chains,
				topN,
				chainFilterMode,
				chainCategoryFilterMode,
				chainCategories
			})
	)
}

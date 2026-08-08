import { fetchAdapterChainMetrics, fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { resolveAllowedChainNamesFromCategories } from '~/containers/ProDashboard/server/chartBuilder/breakdownChains'
import { cachedJsonResult, type CachedJsonPayload } from '~/server/api/resultCache'
import { mapWithConcurrency } from '~/utils/async'
import {
	BREAKDOWN_COLOR_PALETTE,
	buildAlignedTopAndOthers,
	filterOutToday,
	normalizeDailyPairs,
	sumSeriesByTimestamp,
	type ProtocolChainData
} from '~/utils/breakdowns'

const BREAKDOWN_RESULT_TTL_MS = 10 * 60 * 1000

const CHAIN_NATIVE_BREAKDOWN_LABELS: Record<ChainNativeBreakdownMetric, string> = {
	'chain-fees': 'Chain Fees',
	'chain-revenue': 'Chain Revenue'
}

export type ChainNativeBreakdownMetric = 'chain-fees' | 'chain-revenue'

export const isChainNativeBreakdownMetric = (metric: string): metric is ChainNativeBreakdownMetric =>
	metric === 'chain-fees' || metric === 'chain-revenue'

const CHAIN_NATIVE_BREAKDOWN_CONFIG: Record<
	ChainNativeBreakdownMetric,
	{ adapterType: `${ADAPTER_TYPES}`; dataType?: `${ADAPTER_DATA_TYPES}` }
> = {
	'chain-fees': { adapterType: ADAPTER_TYPES.FEES },
	'chain-revenue': { adapterType: ADAPTER_TYPES.FEES, dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE }
}

const toChainSlugKey = (chain: string): string =>
	chain
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-')

const displayNameFromSlug = (slug: string): string =>
	slug
		.replace(/_/g, '-')
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')

const getBreakdownColor = (index: number): string => {
	const color = BREAKDOWN_COLOR_PALETTE[index % BREAKDOWN_COLOR_PALETTE.length]
	if (color === undefined) throw new Error('Breakdown color palette must not be empty')
	return color
}

async function getChainNativeByChainBreakdownData({
	metric,
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	chainCategories
}: {
	metric: ChainNativeBreakdownMetric
	chains: string[]
	topN: number
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	chainCategories: string[]
}): Promise<ProtocolChainData> {
	const config = CHAIN_NATIVE_BREAKDOWN_CONFIG[metric]
	const overview = await fetchAdapterChainMetrics({
		adapterType: config.adapterType,
		chain: 'All',
		...(config.dataType ? { dataType: config.dataType } : {})
	})
	const includeNames = chains.length > 0 ? new Set(chains) : new Set<string>()
	const includeSlugKeys = chains.length > 0 ? new Set(chains.map(toChainSlugKey)) : new Set<string>()
	let allowedCategoryNames: Set<string> | null = null
	let allowedCategorySlugKeys: Set<string> | null = null
	if (chainCategories.length > 0) {
		const allowedNames = await resolveAllowedChainNamesFromCategories(chainCategories)
		allowedCategoryNames = allowedNames
		allowedCategorySlugKeys = new Set(Array.from(allowedNames, (name) => toChainSlugKey(name)))
	}

	const rankedEntries: Array<{ name: string; slug: string; slugKey: string; total24h: number }> = []
	for (const protocol of overview.protocols) {
		if (protocol.protocolType?.toLowerCase() !== 'chain') continue
		const name = protocol.name
		const slug = protocol.slug || toChainSlugKey(name)
		const total24h = protocol.total24h ?? 0
		if (total24h <= 0) continue
		const entry = {
			name: name || displayNameFromSlug(slug),
			slug,
			slugKey: toChainSlugKey(slug),
			total24h
		}
		if (chains.length > 0) {
			const matches = includeNames.has(entry.name) || includeSlugKeys.has(entry.slugKey)
			if (chainFilterMode === 'include' ? !matches : matches) continue
		}
		if (allowedCategoryNames && allowedCategorySlugKeys && allowedCategoryNames.size > 0) {
			const matches = allowedCategoryNames.has(entry.name) || allowedCategorySlugKeys.has(entry.slugKey)
			if (chainCategoryFilterMode === 'include' ? !matches : matches) continue
		}
		rankedEntries.push(entry)
	}
	rankedEntries.sort((a, b) => b.total24h - a.total24h)

	if (rankedEntries.length === 0) {
		return {
			series: [],
			metadata: {
				protocol: 'All Protocols',
				metric: CHAIN_NATIVE_BREAKDOWN_LABELS[metric],
				chains: [],
				totalChains: 0,
				topN: 0,
				othersCount: 0
			}
		}
	}

	const picked = rankedEntries.slice(0, Math.min(topN, rankedEntries.length))
	const seriesRaw = await mapWithConcurrency(picked, 8, async (entry, index) => {
		const chart = await fetchAdapterProtocolChartData({
			adapterType: config.adapterType,
			protocol: entry.slug,
			...(config.dataType ? { dataType: config.dataType } : {})
		})
		return {
			name: entry.name,
			data: filterOutToday(normalizeDailyPairs(chart, 'sum')),
			color: getBreakdownColor(index)
		}
	})
	const totalNormalized = Array.from(sumSeriesByTimestamp(seriesRaw.map((series) => series.data))).sort(
		(a, b) => a[0] - b[0]
	)
	const { alignedTopSeries } = buildAlignedTopAndOthers(seriesRaw, totalNormalized)
	const includedTopCount = alignedTopSeries.length

	return {
		series: alignedTopSeries,
		metadata: {
			protocol: 'All Protocols',
			metric: CHAIN_NATIVE_BREAKDOWN_LABELS[metric],
			chains: alignedTopSeries.map((entry) => entry.name),
			totalChains: rankedEntries.length,
			topN: includedTopCount,
			othersCount: Math.max(0, rankedEntries.length - includedTopCount)
		}
	}
}

interface ChainNativeBreakdownRequest {
	metric: ChainNativeBreakdownMetric
	chains: string[]
	topN: number
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	chainCategories: string[]
}

export function getCachedChainNativeBreakdown({
	metric,
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	chainCategories
}: ChainNativeBreakdownRequest): Promise<CachedJsonPayload<ProtocolChainData>> {
	const cacheKey = JSON.stringify([metric, chains, topN, chainFilterMode, chainCategoryFilterMode, chainCategories])
	return cachedJsonResult(
		'chains-breakdown-chain-native',
		cacheKey,
		{ ttlMs: BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2 },
		() =>
			getChainNativeByChainBreakdownData({
				metric,
				chains,
				topN,
				chainFilterMode,
				chainCategoryFilterMode,
				chainCategories
			})
	)
}

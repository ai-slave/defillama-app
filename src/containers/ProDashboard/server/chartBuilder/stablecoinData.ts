import { resolveAllowedChainNamesFromCategories } from '~/containers/ProDashboard/server/chartBuilder/breakdownChains'
import { fetchStablecoinChartAllApi, fetchStablecoinDominanceAllApi } from '~/containers/Stablecoins/api'
import type { StablecoinDominanceChartPoint } from '~/containers/Stablecoins/api.types'
import { buildStablecoinAggregatePairs, sumStablecoinPegBalances } from '~/containers/Stablecoins/utils'
import { stableCacheKey } from '~/server/api/cacheKey'
import { addApiRoutePhase, timeApiRoutePhase } from '~/server/api/phaseTelemetry'
import { cachedJsonResult, cachedResult, type CachedJsonPayload } from '~/server/api/resultCache'
import {
	BREAKDOWN_COLOR_PALETTE,
	buildAlignedTopAndOthers,
	filterOutToday,
	normalizeDailyPairs,
	type ChartSeries,
	type ProtocolChainData
} from '~/utils/breakdowns'

const BREAKDOWN_RESULT_TTL_MS = 10 * 60 * 1000
const BREAKDOWN_STALE_MS = 20 * 60 * 1000
const STABLECOIN_BASE_CACHE_MS = 10 * 60 * 1000
const STABLECOIN_BASE_STALE_MS = 20 * 60 * 1000

interface StablecoinChainCandidate {
	name: string
	data: [number, number][]
	lastValue: number
}

interface StablecoinByChainBase {
	candidates: StablecoinChainCandidate[]
	totalPairs: [number, number][]
}

// Pegged-assets chart dates are Unix-second strings and USD totals are flat peg-type maps.
const toStablecoinPair = (point: StablecoinDominanceChartPoint): [number, number] => [
	Number(point.date),
	sumStablecoinPegBalances(point.totalCirculatingUSD)
]

async function getStablecoinByChainBaseData(): Promise<StablecoinByChainBase> {
	return cachedResult(
		'stablecoins-breakdown-chain-base',
		'all',
		{ ttlMs: STABLECOIN_BASE_CACHE_MS, ttlJitter: 0.2, staleWhileRevalidateMs: STABLECOIN_BASE_STALE_MS },
		async () => {
			const [aggregatedJson, dominanceJson] = await Promise.all([
				timeApiRoutePhase('stablecoin_fetch_aggregate', () => fetchStablecoinChartAllApi()),
				timeApiRoutePhase('stablecoin_fetch_dominance', () => fetchStablecoinDominanceAllApi())
			])
			const candidates: StablecoinChainCandidate[] = []
			const candidateStartedAt = Date.now()

			for (const chainName in dominanceJson.chainChartMap) {
				const charts = dominanceJson.chainChartMap[chainName]
				if (chainName === 'All' || !charts?.length) continue
				const normalized = filterOutToday(normalizeDailyPairs(charts.map(toStablecoinPair), 'last'))
				const lastValue = normalized[normalized.length - 1]?.[1] ?? 0
				if (normalized.length === 0) continue
				candidates.push({ name: chainName, data: normalized, lastValue })
			}
			addApiRoutePhase('stablecoin_base_chains', Date.now() - candidateStartedAt)

			const aggregateStartedAt = Date.now()
			const totalPairs = filterOutToday(normalizeDailyPairs(buildStablecoinAggregatePairs(aggregatedJson), 'last'))
			addApiRoutePhase('stablecoin_base_total', Date.now() - aggregateStartedAt)
			return { candidates, totalPairs }
		}
	)
}

interface StablecoinChainBreakdownRequest {
	chains: string[]
	topN: number | null
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	chainCategories: string[]
	includeHistoricalSeries?: boolean
}

async function getStablecoinByChainBreakdownData({
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	chainCategories,
	includeHistoricalSeries = false
}: StablecoinChainBreakdownRequest): Promise<ProtocolChainData> {
	const base = await getStablecoinByChainBaseData()
	const projectStartedAt = Date.now()
	const includeSet = chains.length > 0 ? new Set(chains) : null
	const allowedCategoryNames =
		chainCategories.length > 0
			? await timeApiRoutePhase('stablecoin_chain_category_lookup', () =>
					resolveAllowedChainNamesFromCategories(chainCategories)
				)
			: null
	const candidates: StablecoinChainCandidate[] = []
	for (const candidate of base.candidates) {
		if (!includeHistoricalSeries && candidate.lastValue <= 0) continue
		if (includeSet) {
			const matches = includeSet.has(candidate.name)
			if (chainFilterMode === 'include' ? !matches : matches) continue
		}
		if (allowedCategoryNames !== null) {
			const matches = allowedCategoryNames.has(candidate.name)
			if (chainCategoryFilterMode === 'include' ? !matches : matches) continue
		}
		candidates.push(candidate)
	}

	if (candidates.length === 0) {
		addApiRoutePhase('stablecoin_project', Date.now() - projectStartedAt)
		return {
			series: [],
			metadata: {
				protocol: 'All Protocols',
				metric: 'Stablecoin Mcap',
				chains: [],
				totalChains: 0,
				topN: 0,
				othersCount: 0
			}
		}
	}

	candidates.sort((a, b) => b.lastValue - a.lastValue)
	const picked = topN === null ? candidates : candidates.slice(0, Math.min(topN, candidates.length))
	const pickedSeries: ChartSeries[] = picked.map((entry, index) => {
		const color = BREAKDOWN_COLOR_PALETTE[index % BREAKDOWN_COLOR_PALETTE.length]
		return { name: entry.name, data: entry.data, ...(color === undefined ? {} : { color }) }
	})
	let scopedTotalPairs = base.totalPairs
	if (includeSet || allowedCategoryNames !== null) {
		const totalsByTimestamp = new Map<number, number>()
		for (const candidate of candidates) {
			for (const [timestamp, value] of candidate.data) {
				totalsByTimestamp.set(timestamp, (totalsByTimestamp.get(timestamp) ?? 0) + value)
			}
		}
		scopedTotalPairs = Array.from(totalsByTimestamp)
		scopedTotalPairs.sort((a, b) => a[0] - b[0])
	}
	const { alignedTopSeries, othersData, allTimestamps } = buildAlignedTopAndOthers(pickedSeries, scopedTotalPairs)
	const othersCount = Math.max(0, candidates.length - picked.length)
	const finalSeries: ChartSeries[] = [...alignedTopSeries]
	if (scopedTotalPairs.length > 0 && allTimestamps.length > 0 && othersCount > 0) {
		let hasOthers = false
		for (const [, value] of othersData) {
			if (value > 0) {
				hasOthers = true
				break
			}
		}
		if (hasOthers) finalSeries.push({ name: `Others (${othersCount} chains)`, data: othersData, color: '#999999' })
	}
	addApiRoutePhase('stablecoin_project', Date.now() - projectStartedAt)

	return {
		series: finalSeries,
		metadata: {
			protocol: 'All Protocols',
			metric: 'Stablecoin Mcap',
			chains: picked.map((entry) => entry.name),
			totalChains: candidates.length,
			topN: picked.length,
			othersCount
		}
	}
}

export function getCachedStablecoinChainBreakdown(
	request: StablecoinChainBreakdownRequest
): Promise<CachedJsonPayload<ProtocolChainData>> {
	const cacheKey = stableCacheKey([
		'all',
		'stablecoins',
		request.chains,
		request.topN,
		request.chainFilterMode,
		request.chainCategoryFilterMode,
		request.chainCategories
	])
	return cachedJsonResult(
		'stablecoins-breakdown-chain',
		cacheKey,
		{ ttlMs: BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2, staleWhileRevalidateMs: BREAKDOWN_STALE_MS },
		() => timeApiRoutePhase('stablecoin_breakdown_compute', () => getStablecoinByChainBreakdownData(request))
	)
}

export async function getCompleteStablecoinChainSeries(
	request: Omit<StablecoinChainBreakdownRequest, 'topN' | 'includeHistoricalSeries'>
): Promise<ProtocolChainData> {
	return getStablecoinByChainBreakdownData({
		...request,
		topN: null,
		includeHistoricalSeries: true
	})
}

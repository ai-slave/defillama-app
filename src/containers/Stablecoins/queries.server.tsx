import { fetchBlockExplorers, fetchLlamaConfig } from '~/api'
import type { LlamaConfigResponse } from '~/api/types'
import {
	buildUniqueStablecoinChartLabels,
	formatPeggedAssetsData,
	formatPeggedChainsData,
	getStablecoinBridgesFromChart,
	getPrevStablecoinTotalFromChart,
	getFreshStablecoinCurrentPoint,
	getStablecoinDominance,
	getStablecoinMcapStatsFromTotals,
	isInactiveStablecoin,
	type IBuildStablecoinChartDataParams,
	type StablecoinChartDataPoint,
	type StablecoinIssuanceType
} from '~/containers/Stablecoins/utils'
import { cachedResult } from '~/server/api/resultCache'
import { getPercentChange, slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { getObjectCache, setObjectCache } from '~/utils/cache-client'
import { getDeprecatedChainsByName } from '~/utils/metadata/deprecatedChains'
import { formatUsd } from '~/utils/numberFormat'
import { toUnixMsTimestamp } from '~/utils/timeSeries'
import {
	fetchStablecoinAssetApi,
	fetchStablecoinAssetsApi,
	fetchStablecoinBridgeInfoApi,
	fetchStablecoinChartAllApi,
	fetchStablecoinChartApi,
	fetchStablecoinDominanceAllApi,
	fetchStablecoinPeggedConfigApi,
	fetchStablecoinPricesApi,
	fetchStablecoinRatesApi,
	fetchStablecoinRecentCoinsDataApi
} from './api'
import type {
	StablecoinChainBalanceToken,
	StablecoinChartPoint,
	StablecoinListAsset,
	StablecoinPegType,
	StablecoinRawBridgeBreakdown
} from './api.types'
import {
	buildAreaPayload,
	buildDominancePayload,
	buildStablecoinMcapSummary,
	buildStablecoinOverviewPayload,
	buildStablecoinOverviewPayloadFromCollection,
	buildTotalMcapPayload,
	collectCanonicalStablecoinArea,
	collectStablecoinOverviewChart,
	getTopStablecoinFromLatestPoints,
	type StablecoinAssetChartType,
	type StablecoinBreakdownSelectionOptions,
	type StablecoinChartSeriesPayload,
	type StablecoinChainsChartType,
	type StablecoinOverviewChartCollection,
	type StablecoinOverviewChartType,
	type StablecoinSelectableOverviewChartType
} from './chartSeries'
import { matchesStablecoinFilters, resolveStablecoinFilterState, type StablecoinFilterQuery } from './filterPolicy'
import type {
	PeggedAssetPageProps,
	PeggedAssetsForChartInput,
	PeggedAssetsInput,
	PeggedChainMcapSummary,
	PeggedChainsPageData,
	PeggedOverviewPageData,
	StablecoinBridges,
	StablecoinChainsChartInput,
	StablecoinChainsChartSource,
	StablecoinChainsPageInput,
	StablecoinChainsPageSummaryOptions,
	StablecoinOverviewChartPoint,
	StablecoinOverviewChartInputs,
	StablecoinsGlobalDataCache
} from './types'

const STABLECOINS_CACHE_TTL = 60 * 60 * 24
const STABLECOINS_CACHE_PREFIX = 'stablecoins'
const STABLECOIN_SOURCE_RESULT_CACHE_OPTIONS = {
	ttlMs: 5 * 60 * 1000,
	staleWhileRevalidateMs: 5 * 60 * 1000,
	maxEntries: 128
} as const
const MAX_OVERVIEW_COLLECTIONS_PER_SOURCE = 6

const getStablecoinSelectionOptions = (
	seriesLimit: number | undefined,
	selectedNames: Array<string> | null | undefined,
	excludedNames: Array<string> | null | undefined
): StablecoinBreakdownSelectionOptions => ({
	...(seriesLimit === undefined ? {} : { seriesLimit }),
	...(selectedNames === undefined ? {} : { selectedNames }),
	...(excludedNames === undefined ? {} : { excludedNames })
})

async function withStablecoinsCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	const cacheKey = `${STABLECOINS_CACHE_PREFIX}:${key}`

	try {
		const data = await fetcher()
		await setObjectCache(cacheKey, data, STABLECOINS_CACHE_TTL)
		return data
	} catch (error) {
		const cached = await getObjectCache<T>(cacheKey)
		if (cached !== null) {
			return cached
		}

		throw error
	}
}

const getStablecoinAssets = () =>
	withStablecoinsCache('pegged-assets-v2', async () => {
		const { peggedAssets, chains } = await fetchStablecoinAssetsApi()
		const protocolsDict: Record<string, StablecoinListAsset> = {}
		for (const asset of peggedAssets) protocolsDict[slug(asset.name)] = asset
		return { protocolsDict, peggedAssets, chains }
	})

const getStablecoinPrices = () => withStablecoinsCache('pegged-prices-v2', fetchStablecoinPricesApi)
const getStablecoinRates = () => withStablecoinsCache('pegged-rates', fetchStablecoinRatesApi)
const getStablecoinConfigData = () => withStablecoinsCache('config', fetchLlamaConfig)
const getStablecoinPeggedConfigData = () => withStablecoinsCache('pegged-config', fetchStablecoinPeggedConfigApi)

const getStablecoinBridgeInfo = () => withStablecoinsCache('bridge-info', fetchStablecoinBridgeInfoApi)

const sumRecordValues = (record: Record<string, number> | undefined): number => {
	if (!record) return 0
	let total = 0
	for (const key in record) {
		const value = record[key]
		if (value !== undefined) total += value
	}
	return total
}

function fetchGlobalData({ peggedAssets, chains }: PeggedAssetsInput): StablecoinsGlobalDataCache {
	const chainTotals: Array<{ name: string; total: number }> = []
	for (const chain of chains) {
		chainTotals.push({ name: chain.name, total: sumRecordValues(chain.totalCirculatingUSD) })
	}
	chainTotals.sort((a, b) => b.total - a.total)
	const chainList = chainTotals.map((chain) => chain.name)
	const chainsSet = new Set<string>()
	const chainSet = new Set(chainList)
	for (const asset of peggedAssets) {
		for (const chain of asset.chains) {
			if (chain && chainSet.has(chain)) chainsSet.add(chain)
		}
	}
	return {
		chainList,
		chains: chainList.filter((chain) => chainsSet.has(chain))
	}
}

const normalizeStablecoinSeries = (
	charts: Array<StablecoinChartPoint> | undefined
): Array<StablecoinOverviewChartPoint> => {
	if (!charts?.length) return []
	const normalized: Array<StablecoinOverviewChartPoint> = []
	for (const chart of charts) {
		normalized.push({ date: Number(chart.date), mcap: chart.totalCirculatingUSD ?? {} })
	}
	return normalized
}

const readStablecoinNumericFromChart = (
	chart: Array<StablecoinChartDataPoint> | null | undefined,
	daysBefore: number,
	issuanceType: StablecoinIssuanceType,
	pegType?: StablecoinPegType
): number | null => {
	return getPrevStablecoinTotalFromChart(chart, daysBefore, issuanceType, pegType)
}

export const normalizeStablecoinBridges = (value: StablecoinRawBridgeBreakdown | null): StablecoinBridges => {
	if (!value) return null
	const normalized: NonNullable<StablecoinBridges> = {}
	let hasBridges = false

	for (const bridgeId in value) {
		const bridge = value[bridgeId]
		if (bridge === undefined) continue
		if (typeof bridge === 'number') {
			normalized[bridgeId] = [{ amount: bridge, sourceChain: null }]
			hasBridges = true
			continue
		}
		if (bridge.source !== undefined) {
			if (bridge.amount === undefined) continue
			normalized[bridgeId] = [{ amount: Number(bridge.amount), sourceChain: bridge.source }]
			hasBridges = true
			continue
		}

		const normalizedSources: NonNullable<StablecoinBridges>[string] = []
		for (const sourceChain in bridge) {
			const source = bridge[sourceChain]
			if (!source) continue
			normalizedSources.push({ amount: Number(source.amount), sourceChain })
		}

		if (normalizedSources.length > 0) {
			normalized[bridgeId] = normalizedSources
			hasBridges = true
		}
	}

	return hasBridges ? normalized : null
}

const readStablecoinBridgesFromChart = (
	chart: Array<StablecoinChartDataPoint> | null | undefined,
	daysBefore: number
): StablecoinBridges => {
	const bridges = getStablecoinBridgesFromChart(chart, daysBefore)
	return normalizeStablecoinBridges(bridges)
}

export const buildOverviewChartInputs = ({
	peggedAssets,
	breakdown,
	doublecountedSourceIds
}: PeggedAssetsForChartInput): StablecoinOverviewChartInputs => {
	const chartDataByPeggedAsset: Array<Array<StablecoinOverviewChartPoint>> = []
	const peggedAssetNames = buildUniqueStablecoinChartLabels(peggedAssets, 'symbol')
	const peggedAssetIdToChartDataIndex: Record<string, number> = {}
	const doublecountedIds: Array<number> = []
	const doublecountedSourceIdSet = new Set(doublecountedSourceIds)

	for (const [i, asset] of peggedAssets.entries()) {
		peggedAssetIdToChartDataIndex[asset.id] = i
		const formattedCharts = normalizeStablecoinSeries(breakdown[asset.id])

		if (doublecountedSourceIdSet.has(asset.id)) {
			doublecountedIds.push(i)
		}
		chartDataByPeggedAsset.push(formattedCharts)
	}

	return {
		chartDataByPeggedAsset,
		peggedAssetNames,
		peggedAssetIdToChartDataIndex,
		doublecountedIds
	}
}

type StablecoinOverviewChartSource = StablecoinOverviewChartInputs & {
	peggedAssets: Array<StablecoinListAsset>
	chainMetadata: PeggedAssetsInput['chains']
	filteredIndexes: Array<number>
	chain: string
	filteredPeggedAssets?: ReturnType<typeof formatPeggedAssetsData>
}

const overviewChartCollectionCache = new WeakMap<
	StablecoinOverviewChartSource,
	Map<string, Omit<StablecoinOverviewChartCollection, 'chart'>>
>()

const getStablecoinOverviewChartCollection = ({
	source,
	chart,
	filteredIndexes,
	params
}: {
	source: StablecoinOverviewChartSource
	chart: StablecoinSelectableOverviewChartType
	filteredIndexes: Array<number>
	params: Parameters<typeof collectStablecoinOverviewChart>[0]
}) => {
	let sourceCache = overviewChartCollectionCache.get(source)
	if (!sourceCache) {
		sourceCache = new Map()
		overviewChartCollectionCache.set(source, sourceCache)
	}
	const cacheKey = `${chart === 'tokenInflows' ? 'inflow' : 'area'}:${filteredIndexes.join(',')}`
	const cached = sourceCache.get(cacheKey)
	if (cached) return { chart, ...cached }
	const collection = collectStablecoinOverviewChart(params, chart)
	if (sourceCache.size >= MAX_OVERVIEW_COLLECTIONS_PER_SOURCE) {
		const oldestKey = sourceCache.keys().next().value
		if (oldestKey !== undefined) sourceCache.delete(oldestKey)
	}
	sourceCache.set(cacheKey, { history: collection.history, topToken: collection.topToken })
	return collection
}

type StablecoinOverviewSource = StablecoinOverviewChartSource & {
	chains: Array<string>
	filteredPeggedAssets: ReturnType<typeof formatPeggedAssetsData>
}

const resolveStablecoinOverviewFilteredIndexes = (
	source: Pick<StablecoinOverviewSource, 'filteredPeggedAssets' | 'peggedAssetIdToChartDataIndex'>,
	filters: StablecoinFilterQuery = {}
): Array<number> => {
	const filterState = resolveStablecoinFilterState(filters)

	const indexes: Array<number> = []

	if (!filterState.hasActiveFilters) {
		for (const asset of source.filteredPeggedAssets) {
			const maybeIndex = source.peggedAssetIdToChartDataIndex[asset.id]
			if (maybeIndex == null) continue
			indexes.push(maybeIndex)
		}
		return indexes
	}

	for (const asset of source.filteredPeggedAssets) {
		if (!matchesStablecoinFilters(asset, filterState)) continue

		const maybeIndex = source.peggedAssetIdToChartDataIndex[asset.id]
		if (maybeIndex == null) continue
		indexes.push(maybeIndex)
	}

	return indexes
}

const getStablecoinsOverviewChartSource = async (chain: string | null): Promise<StablecoinOverviewChartSource> => {
	const chainKey = chain ? slug(chain) : 'all'
	return cachedResult('stablecoin-chart-source', `overview:${chainKey}`, STABLECOIN_SOURCE_RESULT_CACHE_OPTIONS, () =>
		withStablecoinsCache(`overview-chart-v4:${chainKey}`, async () => {
			const [{ peggedAssets, chains }, chainData] = await Promise.all([
				getStablecoinAssets(),
				chain ? fetchStablecoinChartApi(chain) : fetchStablecoinChartAllApi()
			])

			const chartInputs = buildOverviewChartInputs({
				peggedAssets,
				breakdown: chainData.breakdown,
				doublecountedSourceIds: chainData.doublecountedIds
			})

			const chainSlug = chain ? slug(chain) : null
			const filteredIndexes: Array<number> = []
			for (const [index, asset] of peggedAssets.entries()) {
				if (!chainSlug || asset.chains.some((assetChain) => slug(assetChain) === chainSlug)) {
					filteredIndexes.push(index)
				}
			}

			return {
				...chartInputs,
				peggedAssets,
				chainMetadata: chains,
				filteredIndexes,
				chain: chain ?? 'All'
			}
		})
	)
}

const getStablecoinsOverviewSource = async (chain: string | null): Promise<StablecoinOverviewSource> => {
	const chainKey = chain ? slug(chain) : 'all'
	return cachedResult('stablecoin-page-source', `overview:${chainKey}`, STABLECOIN_SOURCE_RESULT_CACHE_OPTIONS, () =>
		withStablecoinsCache(`overview-page-v4:${chainKey}`, async () => {
			const [chartSource, priceData, rateData] = await Promise.all([
				getStablecoinsOverviewChartSource(chain),
				getStablecoinPrices().catch(() => null),
				getStablecoinRates().catch(() => null)
			])
			const { peggedAssets, chainMetadata } = chartSource
			return {
				...chartSource,
				chains: fetchGlobalData({ peggedAssets, chains: chainMetadata }).chains,
				filteredPeggedAssets: formatPeggedAssetsData({
					peggedAssets,
					chartDataByPeggedAsset: chartSource.chartDataByPeggedAsset,
					...(priceData ? { priceData } : {}),
					...(rateData ? { rateData } : {}),
					peggedAssetIdToChartDataIndex: chartSource.peggedAssetIdToChartDataIndex,
					doublecountedIndexes: chartSource.doublecountedIds,
					...(chain ? { chain } : {})
				})
			}
		})
	)
}

const buildStablecoinOverviewChartSeries = (
	source: StablecoinOverviewChartSource,
	{
		chart,
		filters = {},
		seriesLimit,
		selectedNames,
		excludedNames
	}: {
		chart: StablecoinOverviewChartType
		filters?: StablecoinFilterQuery
		seriesLimit?: number
		selectedNames?: Array<string> | null
		excludedNames?: Array<string> | null
	}
): StablecoinChartSeriesPayload => {
	const filterState = resolveStablecoinFilterState(filters)
	const filteredIndexes =
		filterState.hasActiveFilters && source.filteredPeggedAssets
			? resolveStablecoinOverviewFilteredIndexes(
					{
						filteredPeggedAssets: source.filteredPeggedAssets,
						peggedAssetIdToChartDataIndex: source.peggedAssetIdToChartDataIndex
					},
					filters
				)
			: source.filteredIndexes
	const baseParams: IBuildStablecoinChartDataParams = {
		chartDataByAssetOrChain: source.chartDataByPeggedAsset,
		assetsOrChainsList: source.peggedAssetNames,
		filteredIndexes,
		issuanceType: 'mcap',
		selectedChain: source.chain,
		doublecountedIds: source.doublecountedIds
	}
	if (chart === 'tokenMcaps' || chart === 'dominance' || chart === 'tokenInflows') {
		const collection = getStablecoinOverviewChartCollection({ source, chart, filteredIndexes, params: baseParams })
		return buildStablecoinOverviewPayloadFromCollection(
			collection,
			getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
		)
	}
	const topToken = getTopStablecoinFromLatestPoints(baseParams)
	return buildStablecoinOverviewPayload(
		baseParams,
		chart,
		topToken,
		getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
	)
}

export const getStablecoinOverviewChartSeries = async ({
	chain,
	chart,
	filters = {},
	seriesLimit,
	selectedNames,
	excludedNames
}: {
	chain: string | null
	chart: StablecoinOverviewChartType
	filters?: StablecoinFilterQuery
	seriesLimit?: number
	selectedNames?: Array<string> | null
	excludedNames?: Array<string> | null
}): Promise<StablecoinChartSeriesPayload> => {
	const hasFilters = resolveStablecoinFilterState(filters).hasActiveFilters
	const source = hasFilters ? await getStablecoinsOverviewSource(chain) : await getStablecoinsOverviewChartSource(chain)
	return buildStablecoinOverviewChartSeries(source, {
		chart,
		filters,
		...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
	})
}

export async function getStablecoinChainMcapSummary(chain: string | null): Promise<PeggedChainMcapSummary> {
	const chainKey = chain != null ? slug(chain) : 'all'
	return withStablecoinsCache(`overview-summary-v2:${chainKey}`, async () => {
		const [{ peggedAssets }, chainData] = await Promise.all([
			getStablecoinAssets(),
			chain ? fetchStablecoinChartApi(chain) : fetchStablecoinChartAllApi()
		])
		const { chartDataByPeggedAsset, peggedAssetNames, doublecountedIds } = buildOverviewChartInputs({
			peggedAssets,
			breakdown: chainData.breakdown,
			doublecountedSourceIds: chainData.doublecountedIds
		})
		const filteredIndexes = chartDataByPeggedAsset.map((_, index) => index)

		const chartParams: IBuildStablecoinChartDataParams = {
			chartDataByAssetOrChain: chartDataByPeggedAsset,
			assetsOrChainsList: peggedAssetNames,
			filteredIndexes,
			issuanceType: 'mcap',
			selectedChain: chain ?? 'All',
			doublecountedIds
		}
		const { mcapStats, topToken } = buildStablecoinMcapSummary(chartParams)
		const dominanceValue = getStablecoinDominance(topToken, mcapStats.totalMcapCurrent)
		const dominance = dominanceValue == null ? null : String(dominanceValue)

		return {
			mcap: mcapStats.totalMcapCurrent ?? null,
			change7dUsd: mcapStats.change7dUsd ?? null,
			change7d: mcapStats.change7d ?? null,
			topToken,
			dominance: dominance ?? null,
			mcapChartData: mcapStats.mcapChartData14d
		}
	})
}

export async function getStablecoinsByChainPageData(chain: string | null): Promise<PeggedOverviewPageData> {
	const source = await getStablecoinsOverviewSource(chain)
	const defaultChartData = buildStablecoinOverviewChartSeries(source, { chart: 'totalMcap' })
	return {
		chains: source.chains,
		filteredPeggedAssets: source.filteredPeggedAssets,
		chain: source.chain,
		defaultChartData
	}
}

const toSignedChangeLabel = (value: string | null): string | null => {
	if (value == null) return null
	const numericValue = Number.parseFloat(value.replace(/[^0-9.+-]/g, ''))
	if (!Number.isNaN(numericValue) && numericValue === 0) return value
	const trimmedValue = value.trimStart()
	if (trimmedValue.startsWith('+') || trimmedValue.startsWith('-')) return value
	return `+${value}`
}

export const buildStablecoinChainsPageSummary = (
	raw: StablecoinChainsPageInput,
	{ chainMetadata, currentTimeMs = Date.now() }: StablecoinChainsPageSummaryOptions
): PeggedChainsPageData => {
	const { chainList } = fetchGlobalData(raw)
	const chainsGroupbyParent: Record<string, Record<string, Array<string>>> = {}
	for (const chain of chainList) {
		const parent = raw.chainCoingeckoIds[chain]?.parent
		if (!parent) continue
		const parentGroups = (chainsGroupbyParent[parent.chain] ??= {})
		for (const type of parent.types) {
			if (!parentGroups[type]) parentGroups[type] = []
			parentGroups[type].push(chain)
		}
	}

	const chainDominances: Record<string, { symbol: string; mcap: number }> = {}
	for (const chain of chainList) {
		const charts = raw.dominanceMap[chain]
		const greatestChainMcap = charts?.[charts.length - 1]?.greatestMcap
		if (greatestChainMcap) chainDominances[chain] = greatestChainMcap
	}

	const chainCirculatings = formatPeggedChainsData({
		chainList,
		peggedChartDataByChain: chainList.map((chain) => raw.chainChartMap[chain] ?? null),
		chainDominances,
		currentTimeMs
	})
	const mcapStats = getStablecoinMcapStatsFromTotals(raw.aggregatedChart, currentTimeMs)
	const {
		totalMcapCurrent,
		totalMcapPrevDay,
		totalMcapPrevWeek,
		totalMcapPrevMonth,
		change1d,
		change7d,
		change30d,
		dataTimestamp,
		isDataStale
	} = mcapStats

	const formatAbsoluteChange = (previous: number | null): string | null =>
		totalMcapCurrent != null && previous != null
			? formatUsd(String(totalMcapCurrent - previous), {
					compact: true,
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})
			: null
	const change1d_nol = formatAbsoluteChange(totalMcapPrevDay)
	const change7d_nol = formatAbsoluteChange(totalMcapPrevWeek)
	const change30d_nol = formatAbsoluteChange(totalMcapPrevMonth)
	const deprecatedChains = getDeprecatedChainsByName(chainMetadata, chainList)
	return {
		chainCirculatings,
		chainList,
		chainsGroupbyParent,
		deprecatedChains,
		change1d: toSignedChangeLabel(change1d),
		change7d: toSignedChangeLabel(change7d),
		change30d: toSignedChangeLabel(change30d),
		totalMcapCurrent,
		change1d_nol: toSignedChangeLabel(change1d_nol),
		change7d_nol: toSignedChangeLabel(change7d_nol),
		change30d_nol: toSignedChangeLabel(change30d_nol),
		dataTimestamp,
		isDataStale
	}
}

type StablecoinChainsPageCacheEntry = {
	pageData: PeggedChainsPageData
	latestChainTimestamps: Record<string, number | null>
}

const isStablecoinTimestampFresh = (timestamp: number, currentTimeMs: number): boolean => {
	// dataTimestamp is Unix seconds, matching the canonical stablecoin freshness helper's accepted timestamp units.
	return getFreshStablecoinCurrentPoint([{ date: timestamp }], (point) => point.date, currentTimeMs) != null
}

const revalidateStablecoinChainsPageData = (
	{ pageData, latestChainTimestamps }: StablecoinChainsPageCacheEntry,
	currentTimeMs = Date.now()
): PeggedChainsPageData => {
	// Copy-on-write: the list is cloned once, only if a stale chain needs its deltas cleared.
	let updated: typeof pageData.chainCirculatings | null = null
	for (const [index, chain] of pageData.chainCirculatings.entries()) {
		const timestamp = latestChainTimestamps[chain.name]
		if (timestamp == null || isStablecoinTimestampFresh(timestamp, currentTimeMs)) continue
		if (
			chain.mcapPrevDay == null &&
			chain.mcapPrevWeek == null &&
			chain.mcapPrevMonth == null &&
			chain.change_1d == null &&
			chain.change_7d == null &&
			chain.change_1m == null
		) {
			continue
		}
		if (!updated) updated = pageData.chainCirculatings.slice()
		updated[index] = {
			...chain,
			mcapPrevDay: null,
			mcapPrevWeek: null,
			mcapPrevMonth: null,
			change_1d: null,
			change_7d: null,
			change_1m: null
		}
	}
	const chainCirculatings = updated ?? pageData.chainCirculatings

	const aggregateTimestamp = pageData.dataTimestamp
	const isAggregateStale = aggregateTimestamp != null && !isStablecoinTimestampFresh(aggregateTimestamp, currentTimeMs)
	const aggregateNeedsUpdate =
		isAggregateStale &&
		(!pageData.isDataStale ||
			pageData.change1d != null ||
			pageData.change7d != null ||
			pageData.change30d != null ||
			pageData.change1d_nol != null ||
			pageData.change7d_nol != null ||
			pageData.change30d_nol != null)
	if (!aggregateNeedsUpdate && chainCirculatings === pageData.chainCirculatings) return pageData

	return {
		...pageData,
		chainCirculatings,
		...(aggregateNeedsUpdate
			? {
					change1d: null,
					change7d: null,
					change30d: null,
					change1d_nol: null,
					change7d_nol: null,
					change30d_nol: null,
					isDataStale: true
				}
			: {})
	}
}

export async function getStablecoinChainsPageData(): Promise<PeggedChainsPageData> {
	const cacheEntry = await withStablecoinsCache<StablecoinChainsPageCacheEntry>('chains-page-data-v5', async () => {
		const [{ peggedAssets, chains }, { chainCoingeckoIds }, chartData, { dominanceMap, chainChartMap }, metadataCache] =
			await Promise.all([
				getStablecoinAssets(),
				getStablecoinConfigData(),
				fetchStablecoinChartAllApi(),
				fetchStablecoinDominanceAllApi(),
				import('~/utils/metadata').then((m) => m.default)
			])
		const chartInputs = buildOverviewChartInputs({
			peggedAssets,
			breakdown: chartData.breakdown,
			doublecountedSourceIds: chartData.doublecountedIds
		})
		const aggregateHistory = collectCanonicalStablecoinArea(
			{
				chartDataByAssetOrChain: chartInputs.chartDataByPeggedAsset,
				assetsOrChainsList: chartInputs.peggedAssetNames,
				issuanceType: 'mcap',
				selectedChain: 'All',
				doublecountedIds: chartInputs.doublecountedIds
			},
			{ includeSummary: true }
		).totalPoints
		const pageData = buildStablecoinChainsPageSummary(
			{
				peggedAssets,
				chains,
				chainCoingeckoIds,
				aggregatedChart: aggregateHistory,
				dominanceMap,
				chainChartMap
			},
			{ chainMetadata: metadataCache.chainMetadata }
		)
		const latestChainTimestamps: Record<string, number | null> = {}
		for (const chain of pageData.chainList) {
			const history = chainChartMap[chain]
			const latestPoint = history?.[history.length - 1]
			latestChainTimestamps[chain] = latestPoint ? toUnixMsTimestamp(latestPoint.date) / 1e3 : null
		}
		return { pageData, latestChainTimestamps }
	})
	return revalidateStablecoinChainsPageData(cacheEntry)
}

export const buildStablecoinChainsChartSource = (raw: StablecoinChainsChartInput): StablecoinChainsChartSource => {
	const { chainList } = fetchGlobalData({ peggedAssets: [], chains: raw.chains })
	const chartDataByChain: StablecoinChainsChartSource['chartDataByChain'] = []
	for (const chain of chainList) {
		const charts = raw.chainChartMap[chain]
		if (!charts) {
			chartDataByChain.push(null)
			continue
		}
		const formattedCharts: Array<{ date: number; mcap: number | null }> = []
		for (const chartPoint of charts) {
			const totals = chartPoint.totalCirculatingUSD
			let mcap: number | null = null
			if (totals) mcap = sumRecordValues(totals)
			else mcap = 0
			formattedCharts.push({ date: Number(chartPoint.date), mcap })
		}
		chartDataByChain.push(formattedCharts)
	}
	return { chainList, chartDataByChain }
}

export const buildStablecoinChainsChartSeries = (
	source: StablecoinChainsChartSource,
	{
		chart,
		includeUnreleased = false,
		seriesLimit,
		selectedNames,
		excludedNames
	}: {
		chart: StablecoinChainsChartType
		includeUnreleased?: boolean
		seriesLimit?: number
		selectedNames?: Array<string> | null
		excludedNames?: Array<string> | null
	}
): StablecoinChartSeriesPayload => {
	const baseParams: IBuildStablecoinChartDataParams = {
		chartDataByAssetOrChain: source.chartDataByChain,
		assetsOrChainsList: source.chainList,
		issuanceType: 'mcap'
	}

	if (chart === 'totalMcap') {
		return buildTotalMcapPayload(baseParams)
	}
	if (chart === 'chainMcaps') {
		return buildAreaPayload(baseParams, {
			chartNames: source.chainList,
			stackName: 'chainMcap',
			valueSymbol: '$',
			...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
		})
	}
	return buildDominancePayload(baseParams, {
		chartNames: source.chainList,
		includeUnreleased,
		stackName: 'dominance',
		...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
	})
}

const getStablecoinChainsChartSource = async (): Promise<StablecoinChainsChartSource> => {
	return cachedResult('stablecoin-chart-source', 'chains', STABLECOIN_SOURCE_RESULT_CACHE_OPTIONS, () =>
		withStablecoinsCache('chains-chart-source-v4', async () => {
			const [{ chains }, { chainChartMap }] = await Promise.all([
				getStablecoinAssets(),
				fetchStablecoinDominanceAllApi()
			])
			return buildStablecoinChainsChartSource({ chains, chainChartMap })
		})
	)
}

export const getStablecoinChainsChartSeries = async (
	chart: StablecoinChainsChartType,
	includeUnreleased = false,
	seriesLimit?: number,
	selectedNames?: Array<string> | null,
	excludedNames?: Array<string> | null
): Promise<StablecoinChartSeriesPayload> => {
	const source = await getStablecoinChainsChartSource()
	return buildStablecoinChainsChartSeries(source, {
		chart,
		includeUnreleased,
		...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
	})
}

type StablecoinAssetSource = {
	peggedID: string
	res: Awaited<ReturnType<typeof fetchStablecoinAssetApi>>
	chainCoingeckoIds: LlamaConfigResponse['chainCoingeckoIds']
	recentCoinsData: Awaited<ReturnType<typeof fetchStablecoinRecentCoinsDataApi>>
	bridgeInfo: Awaited<ReturnType<typeof getStablecoinBridgeInfo>>
	blockExplorersData: Awaited<ReturnType<typeof fetchBlockExplorers>>
}

const getStablecoinAssetSource = async (peggedasset: string): Promise<StablecoinAssetSource | null> => {
	const peggedNameToPeggedIDMapping = await getStablecoinPeggedConfigData()
	const peggedID = peggedNameToPeggedIDMapping[peggedasset]
	if (!peggedID) return null

	return cachedResult('stablecoin-chart-source', `asset-v2:${peggedID}`, STABLECOIN_SOURCE_RESULT_CACHE_OPTIONS, () =>
		withStablecoinsCache(`asset-source-v2:${peggedID}`, async () => {
			const [res, { chainCoingeckoIds }, recentCoinsData, bridgeInfo, blockExplorersData] = await Promise.all([
				fetchStablecoinAssetApi(peggedID),
				getStablecoinConfigData().catch(() => ({ chainCoingeckoIds: {} })),
				fetchStablecoinRecentCoinsDataApi().catch(() => ({})),
				getStablecoinBridgeInfo().catch(() => ({})),
				fetchBlockExplorers().catch(() => [])
			])
			return {
				peggedID,
				res,
				chainCoingeckoIds,
				recentCoinsData,
				bridgeInfo,
				blockExplorersData
			}
		})
	)
}

const buildStablecoinAssetChartSeries = (
	source: StablecoinAssetSource,
	{
		chart,
		includeUnreleased,
		seriesLimit,
		selectedNames,
		excludedNames
	}: {
		chart: StablecoinAssetChartType
		includeUnreleased: boolean
		seriesLimit?: number
		selectedNames?: Array<string> | null
		excludedNames?: Array<string> | null
	}
): StablecoinChartSeriesPayload => {
	const chainsUnique: Array<string> = []
	const chainsData: Array<Array<StablecoinChainBalanceToken>> = []
	for (const chainName in source.res.chainBalances) {
		const chainBalance = source.res.chainBalances[chainName]
		if (!chainBalance) continue
		chainsUnique.push(chainName)
		chainsData.push(chainBalance.tokens)
	}
	const baseParams: IBuildStablecoinChartDataParams = {
		chartDataByAssetOrChain: chainsData,
		assetsOrChainsList: chainsUnique,
		filteredIndexes: chainsUnique.map((_, index) => index),
		issuanceType: 'circulating',
		totalChartTooltipLabel: 'Circulating'
	}

	if (chart === 'totalCirc') {
		return buildTotalMcapPayload(baseParams, {
			totalName: 'Circulating',
			includeUnreleased,
			valueSymbol: source.res.symbol
		})
	}
	if (chart === 'chainMcaps') {
		return buildAreaPayload(baseParams, {
			chartNames: chainsUnique,
			stackName: 'chains',
			valueSymbol: source.res.symbol,
			...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
		})
	}
	return buildDominancePayload(baseParams, {
		chartNames: chainsUnique,
		includeUnreleased,
		stackName: 'dominance',
		...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
	})
}

export const getStablecoinAssetChartSeries = async ({
	peggedasset,
	chart,
	includeUnreleased = false,
	seriesLimit,
	selectedNames,
	excludedNames
}: {
	peggedasset: string
	chart: StablecoinAssetChartType
	includeUnreleased?: boolean
	seriesLimit?: number
	selectedNames?: Array<string> | null
	excludedNames?: Array<string> | null
}): Promise<StablecoinChartSeriesPayload | null> => {
	const source = await getStablecoinAssetSource(peggedasset)
	if (!source) return null
	return buildStablecoinAssetChartSeries(source, {
		chart,
		includeUnreleased,
		...getStablecoinSelectionOptions(seriesLimit, selectedNames, excludedNames)
	})
}

export const getStablecoinAssetPageData = async (
	peggedasset: string
): Promise<{ props: PeggedAssetPageProps } | null> => {
	const source = await getStablecoinAssetSource(peggedasset)
	if (!source) return null
	return withStablecoinsCache(`asset-v2:${source.peggedID}`, async () => {
		const { res, chainCoingeckoIds, recentCoinsData, bridgeInfo, blockExplorersData } = source

		const peggedChart: Array<StablecoinChartDataPoint> | undefined = recentCoinsData[source.peggedID]
		const pegType = res.pegType
		const isInactive = isInactiveStablecoin(res)

		const totalCirculating = isInactive
			? null
			: readStablecoinNumericFromChart(peggedChart, 0, 'totalCirculating', pegType)
		const unreleased = isInactive ? null : readStablecoinNumericFromChart(peggedChart, 0, 'totalUnreleased', pegType)
		const mcap = isInactive ? null : readStablecoinNumericFromChart(peggedChart, 0, 'totalCirculatingUSD', pegType)

		const chainsUnique: Array<string> = []
		const chainCirculatings: PeggedAssetPageProps['chainCirculatings'] = []
		for (const chainName in res.chainBalances) {
			const balance = res.chainBalances[chainName]
			if (!balance) continue
			const { tokens } = balance
			chainsUnique.push(chainName)
			const circulating = isInactive ? null : readStablecoinNumericFromChart(tokens, 0, 'circulating', pegType)
			const chainUnreleased = isInactive ? null : readStablecoinNumericFromChart(tokens, 0, 'unreleased', pegType)
			const bridgedTo = isInactive ? null : readStablecoinNumericFromChart(tokens, 0, 'bridgedTo', pegType)
			const circulatingPrevDay = isInactive ? null : readStablecoinNumericFromChart(tokens, 1, 'circulating', pegType)
			const circulatingPrevWeek = isInactive ? null : readStablecoinNumericFromChart(tokens, 7, 'circulating', pegType)
			const circulatingPrevMonth = isInactive
				? null
				: readStablecoinNumericFromChart(tokens, 30, 'circulating', pegType)
			chainCirculatings.push({
				circulating,
				unreleased: chainUnreleased,
				change_1d: getPercentChange(circulating, circulatingPrevDay),
				change_7d: getPercentChange(circulating, circulatingPrevWeek),
				change_1m: getPercentChange(circulating, circulatingPrevMonth),
				circulatingPrevDay,
				circulatingPrevWeek,
				circulatingPrevMonth,
				bridgedAmount: bridgedTo,
				bridges: isInactive ? null : readStablecoinBridgesFromChart(tokens, 0),
				name: chainName,
				symbol: chainCoingeckoIds[chainName]?.symbol ?? '-'
			})
		}
		chainCirculatings.sort((a, b) => (b.circulating ?? 0) - (a.circulating ?? 0))

		const explorerResult = getBlockExplorerNew({
			apiResponse: blockExplorersData,
			address: res.address ?? '',
			urlType: 'token'
		})
		const {
			chainBalances: _chainBalances,
			currentChainBalances: _currentChainBalances,
			tokens: _tokens,
			...peggedAssetData
		} = res

		return {
			props: {
				chainsUnique,
				chainCirculatings,
				peggedAssetData,
				defaultChartData: buildStablecoinAssetChartSeries(source, {
					chart: 'totalCirc',
					includeUnreleased: false
				}),
				totalCirculating,
				unreleased,
				mcap,
				bridgeInfo,
				blockExplorerUrl: explorerResult?.url ?? null,
				blockExplorerName: explorerResult?.name ?? null
			}
		}
	})
}

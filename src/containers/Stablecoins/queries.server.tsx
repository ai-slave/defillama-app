import { fetchBlockExplorers, fetchLlamaConfig } from '~/api'
import {
	buildUniqueStablecoinChartLabels,
	formatPeggedAssetsData,
	formatPeggedChainsData,
	getPrevStablecoinTotalFromChart,
	getFreshStablecoinCurrentPoint,
	getStablecoinDominance,
	type StablecoinChartDataPoint
} from '~/containers/Stablecoins/utils'
import { formattedNum, getPercentChange, slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { getObjectCache, setObjectCache } from '~/utils/cache-client'
import { getDeprecatedChainsByName } from '~/utils/metadata/deprecatedChains'
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
import type { StablecoinChainBalanceToken, StablecoinChartPoint, StablecoinListAsset } from './api.types'
import {
	buildAreaPayload,
	buildDominancePayload,
	buildStablecoinMcapSummary,
	buildStablecoinOverviewPayload,
	buildTotalMcapPayload,
	getTopStablecoinFromLatestPoints,
	type StablecoinAssetChartType,
	type StablecoinChartSeriesPayload,
	type StablecoinChainsChartType,
	type StablecoinOverviewChartType
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
	StablecoinOverviewChartInputs,
	StablecoinsGlobalDataCache
} from './types'

const STABLECOINS_CACHE_TTL = 60 * 60 * 24
const STABLECOINS_CACHE_PREFIX = 'stablecoins'

async function withStablecoinsCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	const cacheKey = `${STABLECOINS_CACHE_PREFIX}:${key}`

	try {
		const data = await fetcher()
		await setObjectCache(cacheKey, data, STABLECOINS_CACHE_TTL)
		return data
	} catch (error) {
		const cached = await getObjectCache(cacheKey)
		if (cached !== null) {
			return cached as T
		}

		throw error
	}
}

const getStablecoinAssets = () =>
	withStablecoinsCache('pegged-assets', () =>
		fetchStablecoinAssetsApi().then(({ peggedAssets, chains }) => ({
			protocolsDict: peggedAssets.reduce(
				(acc, curr) => {
					acc[slug(curr.name)] = curr
					return acc
				},
				{} as Record<string, StablecoinListAsset>
			),
			peggedAssets,
			chains
		}))
	)

const getStablecoinPrices = () => withStablecoinsCache('pegged-prices', fetchStablecoinPricesApi)
const getStablecoinRates = () => withStablecoinsCache('pegged-rates', fetchStablecoinRatesApi)
const getStablecoinConfigData = () => withStablecoinsCache('config', fetchLlamaConfig)
const getStablecoinPeggedConfigData = () => withStablecoinsCache('pegged-config', fetchStablecoinPeggedConfigApi)

const getStablecoinBridgeInfo = () => withStablecoinsCache('bridge-info', fetchStablecoinBridgeInfoApi)

const sumRecordValues = (record: Record<string, number> | undefined): number => {
	if (!record) return 0
	let total = 0
	for (const key in record) {
		total += record[key]
	}
	return total
}

function fetchGlobalData({ peggedAssets, chains }: PeggedAssetsInput): StablecoinsGlobalDataCache {
	const tvlMap: Record<string, number> = {}
	for (const chain of chains) {
		tvlMap[chain.name] = sumRecordValues(chain.totalCirculatingUSD)
	}
	const chainList = chains
		.toSorted((a, b) => sumRecordValues(b.totalCirculatingUSD) - sumRecordValues(a.totalCirculatingUSD))
		.map((chain) => chain.name)
	const chainsSet = new Set<string>()
	const chainSet = new Set(chainList)
	for (const asset of peggedAssets) {
		for (const chain of asset.chains ?? []) {
			if (chain && chainSet.has(chain)) chainsSet.add(chain)
		}
	}
	return {
		chainList,
		chains: chainList.filter((chain) => chainsSet.has(chain)),
		chainsTVLData: chainList.map((chain) => tvlMap[chain])
	}
}

type StablecoinSeriesPoint = { date: number; mcap: Record<string, number>; isSynthetic?: boolean }

const toStablecoinSeriesPoint = (chart: StablecoinChartPoint): StablecoinSeriesPoint | null => {
	const mcap = chart.totalCirculatingUSD
	if (!mcap || typeof mcap !== 'object') return null
	const date = Number(chart.date)
	return { date, mcap }
}

const normalizeStablecoinSeries = (charts: StablecoinChartPoint[] | undefined): StablecoinSeriesPoint[] => {
	if (!charts?.length) return []
	const normalized: StablecoinSeriesPoint[] = []
	for (const chart of charts) {
		const point = toStablecoinSeriesPoint(chart)
		if (point) normalized.push(point)
	}
	return normalized
}

const readStablecoinNumericFromChart = (
	chart: StablecoinChartDataPoint[] | null | undefined,
	daysBefore: number,
	issuanceType: string,
	pegType?: string
): number | null => {
	return getPrevStablecoinTotalFromChart(chart, daysBefore, issuanceType, pegType)
}

export const normalizeStablecoinBridges = (value: unknown): StablecoinBridges => {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return null

	const normalized: NonNullable<StablecoinBridges> = {}
	const bridgesRecord = value as Record<string, unknown>
	let hasBridges = false

	for (const bridgeId in bridgesRecord) {
		const sourcesValue = bridgesRecord[bridgeId]
		if (sourcesValue == null || typeof sourcesValue !== 'object' || Array.isArray(sourcesValue)) continue

		const sourcesRecord = sourcesValue as Record<string, unknown>
		const normalizedSources: Record<string, { amount: number }> = {}
		let hasSources = false
		for (const sourceChain in sourcesRecord) {
			const sourceValue = sourcesRecord[sourceChain]
			if (sourceValue == null || typeof sourceValue !== 'object' || Array.isArray(sourceValue)) continue
			const amountRaw = (sourceValue as Record<string, unknown>).amount
			// Backend adapter bridge payloads still allow string-number amounts before storage merges normalize them.
			const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)
			if (!Number.isFinite(amount)) continue
			normalizedSources[sourceChain] = { amount }
			hasSources = true
		}

		if (hasSources) {
			normalized[bridgeId] = normalizedSources
			hasBridges = true
		}
	}

	return hasBridges ? normalized : null
}

const readStablecoinBridgesFromChart = (
	chart: StablecoinChartDataPoint[] | null | undefined,
	daysBefore: number,
	issuanceType: string
): StablecoinBridges => {
	// `getPrevStablecoinTotalFromChart` returns `unknown` for pegType='bridges';
	// normalize it to the `StablecoinBridges` runtime shape (bridgeId -> sourceChain -> { amount }).
	const bridges = getPrevStablecoinTotalFromChart(chart, daysBefore, issuanceType, 'bridges')
	return normalizeStablecoinBridges(bridges)
}

export const buildOverviewChartInputs = ({
	peggedAssets,
	breakdown,
	doublecountedSourceIds
}: PeggedAssetsForChartInput): StablecoinOverviewChartInputs => {
	const chartDataByPeggedAsset: StablecoinSeriesPoint[][] = []
	const peggedAssetNames = buildUniqueStablecoinChartLabels(peggedAssets, 'symbol')
	const peggedAssetIdToChartDataIndex: Record<string, number> = {}
	const doublecountedIds: number[] = []

	for (let i = 0; i < peggedAssets.length; i++) {
		const asset = peggedAssets[i]
		peggedAssetIdToChartDataIndex[asset.id] = i
		const formattedCharts = normalizeStablecoinSeries(breakdown[asset.id])

		if (doublecountedSourceIds?.includes(asset.id)) {
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
	peggedAssets: StablecoinListAsset[]
	chainMetadata: PeggedAssetsInput['chains']
	filteredIndexes: number[]
	chain: string
	filteredPeggedAssets?: ReturnType<typeof formatPeggedAssetsData>
}

type StablecoinOverviewSource = StablecoinOverviewChartSource & {
	chains: string[]
	filteredPeggedAssets: ReturnType<typeof formatPeggedAssetsData>
}

const resolveStablecoinOverviewFilteredIndexes = (
	source: Pick<StablecoinOverviewSource, 'filteredPeggedAssets' | 'peggedAssetIdToChartDataIndex'>,
	filters: StablecoinFilterQuery = {}
): number[] => {
	const filterState = resolveStablecoinFilterState(filters)

	const indexes: number[] = []
	const seen = new Set<number>()

	if (!filterState.hasActiveFilters) {
		for (const asset of source.filteredPeggedAssets) {
			const maybeIndex = source.peggedAssetIdToChartDataIndex[asset.id]
			if (maybeIndex == null || seen.has(maybeIndex)) continue
			seen.add(maybeIndex)
			indexes.push(maybeIndex)
		}
		return indexes
	}

	for (const asset of source.filteredPeggedAssets) {
		if (!matchesStablecoinFilters(asset, filterState)) continue

		const maybeIndex = source.peggedAssetIdToChartDataIndex[asset.id]
		if (maybeIndex == null || seen.has(maybeIndex)) continue
		seen.add(maybeIndex)
		indexes.push(maybeIndex)
	}

	return indexes
}

const getStablecoinsOverviewChartSource = async (chain: string | null): Promise<StablecoinOverviewChartSource> => {
	const chainKey = chain ? slug(chain) : 'all'
	return withStablecoinsCache(`overview-chart-v3:${chainKey}`, async () => {
		const chainLabel = chain ?? 'all-llama-app' // custom key to fetch limited data to reduce page size
		const [{ peggedAssets, chains }, chainData] = await Promise.all([
			getStablecoinAssets(),
			fetchStablecoinChartApi(chainLabel)
		])
		const breakdown = chainData.breakdown
		if (!breakdown) {
			throw new Error(`[getStablecoinsByChainPageData] [${chainLabel}] no breakdown`)
		}

		const chartInputs = buildOverviewChartInputs({
			peggedAssets,
			breakdown,
			doublecountedSourceIds: chainData.doublecountedIds
		})

		const chainSlug = chain ? slug(chain) : null
		const filteredIndexes: number[] = []
		for (let index = 0; index < peggedAssets.length; index++) {
			if (!chainSlug || peggedAssets[index].chains.some((assetChain) => slug(assetChain) === chainSlug)) {
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
}

const getStablecoinsOverviewSource = async (chain: string | null): Promise<StablecoinOverviewSource> => {
	const chainKey = chain ? slug(chain) : 'all'
	return withStablecoinsCache(`overview-page-v3:${chainKey}`, async () => {
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
				priceData,
				rateData,
				peggedAssetIdToChartDataIndex: chartSource.peggedAssetIdToChartDataIndex,
				chain: chain ?? undefined
			})
		}
	})
}

const buildStablecoinOverviewChartSeries = (
	source: StablecoinOverviewChartSource,
	{
		chart,
		filters = {},
		seriesLimit
	}: {
		chart: StablecoinOverviewChartType
		filters?: StablecoinFilterQuery
		seriesLimit?: number
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
	const baseParams = {
		chartDataByAssetOrChain: source.chartDataByPeggedAsset,
		assetsOrChainsList: source.peggedAssetNames,
		filteredIndexes,
		issuanceType: 'mcap',
		selectedChain: source.chain,
		doublecountedIds: source.doublecountedIds,
		carryForwardAfterSeriesEnd: true
	}
	const topToken = getTopStablecoinFromLatestPoints(baseParams)
	return buildStablecoinOverviewPayload(baseParams, chart, topToken, seriesLimit == null ? undefined : { seriesLimit })
}

export const getStablecoinOverviewChartSeries = async ({
	chain,
	chart,
	filters = {},
	seriesLimit
}: {
	chain: string | null
	chart: StablecoinOverviewChartType
	filters?: StablecoinFilterQuery
	seriesLimit?: number
}): Promise<StablecoinChartSeriesPayload> => {
	const hasFilters = resolveStablecoinFilterState(filters).hasActiveFilters
	const source = hasFilters ? await getStablecoinsOverviewSource(chain) : await getStablecoinsOverviewChartSource(chain)
	return buildStablecoinOverviewChartSeries(source, { chart, filters, seriesLimit })
}

export async function getStablecoinChainMcapSummary(chain: string | null): Promise<PeggedChainMcapSummary | null> {
	const chainKey = chain != null ? slug(chain) : 'all'
	return withStablecoinsCache(`overview-summary:${chainKey}`, async () => {
		const chainLabel: string = chain ?? 'all-llama-app'
		const [{ peggedAssets }, chainData] = await Promise.all([
			getStablecoinAssets(),
			fetchStablecoinChartApi(chainLabel)
		])
		const breakdown = chainData.breakdown
		if (!breakdown) return null

		const { chartDataByPeggedAsset, peggedAssetNames, doublecountedIds } = buildOverviewChartInputs({
			peggedAssets,
			breakdown,
			doublecountedSourceIds: chainData.doublecountedIds
		})
		const filteredIndexes = chartDataByPeggedAsset.map((_, index) => index)

		const chartParams = {
			chartDataByAssetOrChain: chartDataByPeggedAsset,
			assetsOrChainsList: peggedAssetNames,
			filteredIndexes,
			issuanceType: 'mcap',
			selectedChain: chain ?? 'All',
			doublecountedIds,
			carryForwardAfterSeriesEnd: true
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
	const { chainList, chainsTVLData } = fetchGlobalData(raw)
	const chainsGroupbyParent: Record<string, Record<string, string[]>> = {}
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
		chainsTVLData,
		currentTimeMs
	})
	const chartLookupOptions = { currentTimeMs }
	const totalMcapCurrent = getPrevStablecoinTotalFromChart(raw.aggregatedChart, 0, 'totalCirculatingUSD')
	const totalMcapPrevDay = getPrevStablecoinTotalFromChart(
		raw.aggregatedChart,
		1,
		'totalCirculatingUSD',
		'',
		chartLookupOptions
	)
	const totalMcapPrevWeek = getPrevStablecoinTotalFromChart(
		raw.aggregatedChart,
		7,
		'totalCirculatingUSD',
		'',
		chartLookupOptions
	)
	const totalMcapPrevMonth = getPrevStablecoinTotalFromChart(
		raw.aggregatedChart,
		30,
		'totalCirculatingUSD',
		'',
		chartLookupOptions
	)

	const change1d = getPercentChange(totalMcapCurrent, totalMcapPrevDay)?.toFixed(2) ?? null
	const change7d = getPercentChange(totalMcapCurrent, totalMcapPrevWeek)?.toFixed(2) ?? null
	const change30d = getPercentChange(totalMcapCurrent, totalMcapPrevMonth)?.toFixed(2) ?? null

	const formatAbsoluteChange = (previous: number | null): string | null =>
		totalMcapCurrent != null && previous != null ? formattedNum(String(totalMcapCurrent - previous), true) : null
	const change1d_nol = formatAbsoluteChange(totalMcapPrevDay)
	const change7d_nol = formatAbsoluteChange(totalMcapPrevWeek)
	const change30d_nol = formatAbsoluteChange(totalMcapPrevMonth)
	const deprecatedChains = getDeprecatedChainsByName(chainMetadata, chainList)
	const latestPoint = raw.aggregatedChart[raw.aggregatedChart.length - 1]
	const dataTimestamp = latestPoint ? toUnixMsTimestamp(latestPoint.date) / 1e3 : null
	const isDataStale =
		latestPoint != null &&
		getFreshStablecoinCurrentPoint(raw.aggregatedChart, (point) => point.date, currentTimeMs) == null

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
	let chainCirculatings = pageData.chainCirculatings
	for (let index = 0; index < pageData.chainCirculatings.length; index++) {
		const chain = pageData.chainCirculatings[index]
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
		if (chainCirculatings === pageData.chainCirculatings) chainCirculatings = [...chainCirculatings]
		chainCirculatings[index] = {
			...chain,
			mcapPrevDay: null,
			mcapPrevWeek: null,
			mcapPrevMonth: null,
			change_1d: null,
			change_7d: null,
			change_1m: null
		}
	}

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
	const cacheEntry = await withStablecoinsCache<StablecoinChainsPageCacheEntry>('chains-page-data-v4', async () => {
		const [
			{ peggedAssets, chains },
			{ chainCoingeckoIds },
			{ aggregated: aggregatedChart },
			{ dominanceMap, chainChartMap },
			metadataCache
		] = await Promise.all([
			getStablecoinAssets(),
			getStablecoinConfigData(),
			fetchStablecoinChartAllApi(),
			fetchStablecoinDominanceAllApi(),
			import('~/utils/metadata').then((m) => m.default)
		])
		const pageData = buildStablecoinChainsPageSummary(
			{
				peggedAssets,
				chains,
				chainCoingeckoIds,
				aggregatedChart: aggregatedChart ?? [],
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
			if (totals) {
				let total = 0
				let hasValue = false
				for (const pegType in totals) {
					total += totals[pegType]
					hasValue = true
				}
				if (hasValue) mcap = total
			}
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
		seriesLimit
	}: { chart: StablecoinChainsChartType; includeUnreleased?: boolean; seriesLimit?: number }
): StablecoinChartSeriesPayload => {
	const baseParams = {
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
			seriesLimit
		})
	}
	return buildDominancePayload(baseParams, {
		chartNames: source.chainList,
		includeUnreleased,
		stackName: 'dominance',
		seriesLimit
	})
}

const getStablecoinChainsChartSource = async (): Promise<StablecoinChainsChartSource> => {
	return withStablecoinsCache('chains-chart-source-v3', async () => {
		const [{ chains }, { chainChartMap }] = await Promise.all([getStablecoinAssets(), fetchStablecoinDominanceAllApi()])
		return buildStablecoinChainsChartSource({ chains, chainChartMap })
	})
}

export const getStablecoinChainsChartSeries = async (
	chart: StablecoinChainsChartType,
	includeUnreleased = false,
	seriesLimit?: number
): Promise<StablecoinChartSeriesPayload> => {
	const source = await getStablecoinChainsChartSource()
	return buildStablecoinChainsChartSeries(source, { chart, includeUnreleased, seriesLimit })
}

type StablecoinAssetSource = {
	peggedID: string
	res: NonNullable<Awaited<ReturnType<typeof fetchStablecoinAssetApi>>>
	chainCoingeckoIds: Record<string, { symbol?: string }>
	recentCoinsData: Awaited<ReturnType<typeof fetchStablecoinRecentCoinsDataApi>>
	bridgeInfo: Awaited<ReturnType<typeof getStablecoinBridgeInfo>>
	blockExplorersData: Awaited<ReturnType<typeof fetchBlockExplorers>>
}

const getStablecoinAssetSource = async (peggedasset: string): Promise<StablecoinAssetSource | null> => {
	const peggedNameToPeggedIDMapping = await getStablecoinPeggedConfigData()
	const peggedID = peggedNameToPeggedIDMapping[peggedasset]
	if (!peggedID) return null

	return withStablecoinsCache(`asset-source:${peggedID}`, async () => {
		const [res, { chainCoingeckoIds }, recentCoinsData, bridgeInfo, blockExplorersData] = await Promise.all([
			fetchStablecoinAssetApi(peggedID),
			getStablecoinConfigData().catch(() => ({ chainCoingeckoIds: {} })),
			fetchStablecoinRecentCoinsDataApi().catch(() => ({})),
			getStablecoinBridgeInfo().catch(() => null),
			fetchBlockExplorers().catch(() => [])
		])
		if (!res) return null
		return {
			peggedID,
			res,
			chainCoingeckoIds,
			recentCoinsData,
			bridgeInfo,
			blockExplorersData
		}
	})
}

const buildStablecoinAssetChartSeries = (
	source: StablecoinAssetSource,
	{
		chart,
		includeUnreleased,
		seriesLimit
	}: {
		chart: StablecoinAssetChartType
		includeUnreleased: boolean
		seriesLimit?: number
	}
): StablecoinChartSeriesPayload => {
	const chainsUnique: string[] = []
	for (const chainName in source.res.chainBalances ?? {}) {
		chainsUnique.push(chainName)
	}
	const chainsData: StablecoinChainBalanceToken[][] = chainsUnique.map(
		(elem) => source.res.chainBalances[elem]?.tokens ?? []
	)
	const baseParams = {
		chartDataByAssetOrChain: chainsData,
		assetsOrChainsList: chainsUnique,
		filteredIndexes: chainsUnique.map((_, index) => index),
		issuanceType: 'circulating',
		totalChartTooltipLabel: 'Circulating'
	}

	if (chart === 'totalCirc') {
		return buildTotalMcapPayload(baseParams, { totalName: 'Circulating', includeUnreleased })
	}
	if (chart === 'chainMcaps') {
		return buildAreaPayload(baseParams, {
			chartNames: chainsUnique,
			stackName: 'chains',
			valueSymbol: '$',
			seriesLimit
		})
	}
	return buildDominancePayload(baseParams, {
		chartNames: chainsUnique,
		includeUnreleased,
		stackName: 'dominance',
		seriesLimit
	})
}

export const getStablecoinAssetChartSeries = async ({
	peggedasset,
	chart,
	includeUnreleased = false,
	seriesLimit
}: {
	peggedasset: string
	chart: StablecoinAssetChartType
	includeUnreleased?: boolean
	seriesLimit?: number
}): Promise<StablecoinChartSeriesPayload | null> => {
	const source = await getStablecoinAssetSource(peggedasset)
	if (!source) return null
	return buildStablecoinAssetChartSeries(source, { chart, includeUnreleased, seriesLimit })
}

export const getStablecoinAssetPageData = async (
	peggedasset: string
): Promise<{ props: PeggedAssetPageProps } | null> => {
	const source = await getStablecoinAssetSource(peggedasset)
	if (!source) return null
	return withStablecoinsCache(`asset:${source.peggedID}`, async () => {
		const { res, chainCoingeckoIds, recentCoinsData, bridgeInfo, blockExplorersData } = source

		const peggedChart: StablecoinChartDataPoint[] | undefined = recentCoinsData[source.peggedID]
		const pegType = res.pegType ?? ''

		const totalCirculating = readStablecoinNumericFromChart(peggedChart, 0, 'totalCirculating', pegType)
		const unreleased = readStablecoinNumericFromChart(peggedChart, 0, 'totalUnreleased', pegType)
		const mcap = readStablecoinNumericFromChart(peggedChart, 0, 'totalCirculatingUSD', pegType)

		const chainsUnique: string[] = []
		for (const chainName in res.chainBalances ?? {}) {
			chainsUnique.push(chainName)
		}
		const chainsData: StablecoinChainBalanceToken[][] = chainsUnique.map(
			(elem) => res.chainBalances[elem]?.tokens ?? []
		)

		const chainCirculatings = chainsUnique
			.map((chainName, i) => {
				const circulating = readStablecoinNumericFromChart(chainsData[i], 0, 'circulating', pegType)
				const chainUnreleased = readStablecoinNumericFromChart(chainsData[i], 0, 'unreleased', pegType)
				const bridgedTo = readStablecoinNumericFromChart(chainsData[i], 0, 'bridgedTo', pegType)
				const bridges = readStablecoinBridgesFromChart(chainsData[i], 0, 'bridgedTo')
				const circulatingPrevDay = readStablecoinNumericFromChart(chainsData[i], 1, 'circulating', pegType)
				const circulatingPrevWeek = readStablecoinNumericFromChart(chainsData[i], 7, 'circulating', pegType)
				const circulatingPrevMonth = readStablecoinNumericFromChart(chainsData[i], 30, 'circulating', pegType)
				const change_1d = getPercentChange(circulating, circulatingPrevDay)
				const change_7d = getPercentChange(circulating, circulatingPrevWeek)
				const change_1m = getPercentChange(circulating, circulatingPrevMonth)

				return {
					circulating,
					unreleased: chainUnreleased,
					change_1d,
					change_7d,
					change_1m,
					circulatingPrevDay,
					circulatingPrevWeek,
					circulatingPrevMonth,
					bridgedAmount: bridgedTo,
					bridges,
					name: chainName,
					symbol: chainCoingeckoIds[chainName]?.symbol ?? '-'
				}
			})
			.sort((a, b) => (b.circulating ?? 0) - (a.circulating ?? 0))

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

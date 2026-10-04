import { useQuery } from '@tanstack/react-query'
import { useCallback, useContext, useMemo } from 'react'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { useIdleChartComputation } from '~/containers/ProDashboard/hooks/useIdleChartComputation'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import {
	buildStablecoinsChartCacheValue,
	type StablecoinsChartCacheValue
} from '~/containers/ProDashboard/stablecoinData'
import { fetchStablecoinAssetsApi, fetchStablecoinChartApi } from '~/containers/Stablecoins/api'
import {
	buildStablecoinOverviewPayload,
	buildStablecoinOverviewPayloadFromCollection,
	collectStablecoinOverviewChart,
	getTopStablecoinFromLatestPoints,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	type StablecoinChartSeriesPayload,
	type StablecoinBreakdownSelectionOptions,
	type StablecoinOverviewChartCollection,
	type StablecoinOverviewChartType
} from '~/containers/Stablecoins/chartSeries'
import type { IBuildStablecoinChartDataParams } from '~/containers/Stablecoins/utils'
import { sumStablecoinPegBalances } from '~/containers/Stablecoins/utils'
import { queryReadFailed } from '~/utils/query'
import type { StablecoinChartType } from '../../../types'

interface UseStablecoinsChartDataResult {
	chartPayload: StablecoinChartSeriesPayload
	pieSeries: RuntimePieChartData
	seriesNames: Array<string>
	availableSeries: Array<string>
	defaultSeries: Array<string>
	totalMcapCurrent: number | null
	prepareCsvDataset: () => MultiSeriesChartDataset
	isLoading: boolean
	isFetching: boolean
	readFailed: boolean
	refetch: () => void
}

const EMPTY_CHART_PAYLOAD: StablecoinChartSeriesPayload = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: [],
	valueSymbol: '$',
	stacked: false,
	showTotalInTooltip: false
}
const EMPTY_PIE_SERIES: RuntimePieChartData = { peers: [], limit: 10, upstreamOthersValue: 0 }
type StablecoinPresentation = Omit<
	UseStablecoinsChartDataResult,
	'prepareCsvDataset' | 'isLoading' | 'isFetching' | 'readFailed' | 'refetch'
>

const EMPTY_STABLECOIN_PRESENTATION: StablecoinPresentation = {
	chartPayload: EMPTY_CHART_PAYLOAD,
	pieSeries: EMPTY_PIE_SERIES,
	seriesNames: [],
	availableSeries: [],
	defaultSeries: [],
	totalMcapCurrent: null
}

export function buildProStablecoinOverviewPayload(
	params: IBuildStablecoinChartDataParams,
	chart: StablecoinOverviewChartType,
	topToken: { symbol: string; mcap: number },
	currentTimeMs: number,
	selectedNames: Array<string> | null
): StablecoinChartSeriesPayload {
	return buildStablecoinOverviewPayload(params, chart, topToken, currentTimeMs, {
		selectedNames,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
		...(chart === 'usdInflows' ? { usdInflowsName: 'USD Inflows' } : {})
	})
}

type ProStablecoinChartCollection =
	| {
			kind: 'selectable'
			collection: StablecoinOverviewChartCollection
			rawData: StablecoinsChartCacheValue
			chartType: StablecoinChartType
			currentTimeMs: number
	  }
	| { kind: 'fixed'; chartType: StablecoinChartType; presentation: typeof EMPTY_STABLECOIN_PRESENTATION }

const getProStablecoinChartParams = (rawData: StablecoinsChartCacheValue, chain: string) => ({
	chartDataByAssetOrChain: rawData.chartDataByPeggedAsset,
	assetsOrChainsList: rawData.peggedAssetNames,
	filteredIndexes: rawData.chartDataByPeggedAsset.map((_, index) => index),
	issuanceType: 'mcap' as const,
	selectedChain: chain,
	doublecountedIds: rawData.doublecountedIds
})

const buildProStablecoinPresentationResult = (
	rawData: StablecoinsChartCacheValue,
	chartType: StablecoinChartType,
	chartPayload: StablecoinChartSeriesPayload
) => {
	const pieSeries =
		chartType === 'pie'
			? prepareRuntimePieChartData({
					// A pie is a share of the aggregate market, which leaves out double-counted assets.
					data: rawData.pieAssets.filter((asset) => asset.aggregateIncluded),
					sliceIdentifier: 'symbol',
					sliceValue: 'mcap',
					limit: 10
				})
			: EMPTY_PIE_SERIES
	let totalMcapCurrent: number | null = null
	if (chartPayload.summary?.totalMcapCurrent != null) {
		totalMcapCurrent = chartPayload.summary.totalMcapCurrent
	} else {
		const lastEntry = chartPayload.dataset.source.at(-1)
		const mcapIndex = chartPayload.dataset.dimensions.indexOf('Mcap')
		const latestMcap = mcapIndex >= 0 ? lastEntry?.[mcapIndex] : null
		if (typeof latestMcap === 'number') {
			totalMcapCurrent = latestMcap
		} else if (chartType === 'pie') {
			let total = 0
			let hasAggregateValue = false
			for (const asset of rawData.pieAssets) {
				if (!asset.aggregateIncluded || asset.mcap == null) continue
				total += asset.mcap
				hasAggregateValue = true
			}
			totalMcapCurrent = hasAggregateValue ? total : null
		}
	}
	const defaultSeries: Array<string> = []
	if (chartType === 'pie') {
		for (const asset of rawData.pieAssets) {
			if (asset.aggregateIncluded && asset.mcap != null && asset.mcap > 0) defaultSeries.push(asset.symbol)
		}
	} else {
		defaultSeries.push(...(chartPayload.defaultSeries ?? []))
	}

	return {
		chartPayload,
		pieSeries,
		seriesNames: rawData.peggedAssetNames,
		availableSeries: chartPayload.availableSeries ?? [],
		defaultSeries,
		totalMcapCurrent
	}
}

export function collectProStablecoinChart({
	rawData,
	chain,
	chartType,
	currentTimeMs
}: {
	rawData: StablecoinsChartCacheValue
	chain: string
	chartType: StablecoinChartType
	/** When the data was fetched: its summary changes describe the period ending then. */
	currentTimeMs: number
}): ProStablecoinChartCollection {
	const params = getProStablecoinChartParams(rawData, chain)
	if (chartType === 'tokenMcaps' || chartType === 'dominance' || chartType === 'tokenInflows') {
		return {
			kind: 'selectable',
			collection: collectStablecoinOverviewChart(params, chartType),
			rawData,
			chartType,
			currentTimeMs
		}
	}
	const chartPayload =
		chartType === 'pie'
			? EMPTY_CHART_PAYLOAD
			: buildProStablecoinOverviewPayload(
					params,
					chartType,
					getTopStablecoinFromLatestPoints(params),
					currentTimeMs,
					null
				)
	return {
		kind: 'fixed',
		chartType,
		presentation: buildProStablecoinPresentationResult(rawData, chartType, chartPayload)
	}
}

export function buildProStablecoinChartPresentationFromCollection(
	collected: ProStablecoinChartCollection,
	selectionOptions?: StablecoinBreakdownSelectionOptions
) {
	if (collected.kind === 'fixed') return collected.presentation
	const chartPayload = buildStablecoinOverviewPayloadFromCollection(collected.collection, collected.currentTimeMs, {
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
		...selectionOptions
	})
	return buildProStablecoinPresentationResult(collected.rawData, collected.chartType, chartPayload)
}

/** The chart's picked series without the series limit; the pie card exports from its own pie selection. */
export function buildProStablecoinCsvDataset(
	collected: ProStablecoinChartCollection,
	selectionOptions: StablecoinBreakdownSelectionOptions | undefined
): MultiSeriesChartDataset {
	if (collected.kind === 'selectable') {
		return buildStablecoinOverviewPayloadFromCollection(collected.collection, collected.currentTimeMs, selectionOptions)
			.dataset
	}
	return collected.presentation.chartPayload.dataset
}

export function useStablecoinsChartData(
	chain: string,
	chartType: StablecoinChartType,
	enabled = true,
	selectionOptions?: StablecoinBreakdownSelectionOptions
): UseStablecoinsChartDataResult {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const chartQuery = useQuery({
		queryKey: ['pro-dashboard', 'stablecoins-chart-data', chain],
		enabled: enabled && streamDone,
		queryFn: async () => {
			if (authToken) {
				return fetchProDashboardProxy('stablecoins', { chain }, authToken)
			}

			const [peggedData, chainData] = await Promise.all([
				fetchStablecoinAssetsApi(),
				fetchStablecoinChartApi(chain === 'All' ? 'all' : chain)
			])

			return buildStablecoinsChartCacheValue({
				peggedData,
				chainData,
				chain
			})
		},
		staleTime: 5 * 60 * 1000,
		refetchInterval: 5 * 60 * 1000
	})
	const { data: rawData, isLoading, isFetching, dataUpdatedAt, refetch } = chartQuery

	const computeSignature = [chain, chartType, dataUpdatedAt].join('::')
	const { value: collected, isComputing } = useIdleChartComputation({
		enabled: enabled && rawData != null && !isLoading,
		signature: computeSignature,
		input: { rawData, chain, chartType, dataUpdatedAt },
		compute: (input) =>
			input.rawData
				? collectProStablecoinChart({
						rawData: input.rawData,
						chain: input.chain,
						chartType: input.chartType,
						currentTimeMs: input.dataUpdatedAt
					})
				: { kind: 'fixed' as const, chartType: input.chartType, presentation: EMPTY_STABLECOIN_PRESENTATION },
		emptyValue: { kind: 'fixed' as const, chartType, presentation: EMPTY_STABLECOIN_PRESENTATION }
	})
	const presentation = useMemo(
		() => buildProStablecoinChartPresentationFromCollection(collected, selectionOptions),
		[collected, selectionOptions]
	)
	const prepareCsvDataset = useCallback(
		() => buildProStablecoinCsvDataset(collected, selectionOptions),
		[collected, selectionOptions]
	)

	return {
		...presentation,
		prepareCsvDataset,
		isLoading: enabled && (isLoading || (!streamDone && !rawData) || isComputing),
		isFetching,
		readFailed: queryReadFailed(chartQuery),
		refetch
	}
}

export interface StablecoinChainInfo {
	name: string
	tvl: number
}

export function useStablecoinChainsList() {
	const authToken = useContext(ProxyAuthTokenContext)
	return useQuery({
		queryKey: ['pro-dashboard', 'stablecoin-chains-list'],
		queryFn: async () => {
			const data = authToken
				? await fetchProDashboardProxy('stablecoinsList', {}, authToken)
				: await fetchStablecoinAssetsApi()
			const chains: Array<StablecoinChainInfo> = []
			for (const chain of data.chains) {
				chains.push({
					name: chain.name,
					tvl: sumStablecoinPegBalances(chain.totalCirculatingUSD)
				})
			}
			chains.sort((a, b) => b.tvl - a.tvl)
			return chains
		},
		staleTime: 60 * 60 * 1000
	})
}

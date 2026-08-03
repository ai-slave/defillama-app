import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo, useRef } from 'react'
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
import type { StablecoinChartType } from '../../../types'

interface UseStablecoinsChartDataResult {
	chartPayload: StablecoinChartSeriesPayload
	pieSeries: RuntimePieChartData
	seriesNames: string[]
	availableSeries: string[]
	defaultSeries: string[]
	totalMcapCurrent: number | null
	isLoading: boolean
	error: Error | null
}

const EMPTY_CHART_PAYLOAD: StablecoinChartSeriesPayload = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: []
}
const EMPTY_PIE_SERIES: RuntimePieChartData = { peers: [], limit: 10, upstreamOthersValue: 0 }
type StablecoinPresentation = Omit<UseStablecoinsChartDataResult, 'isLoading' | 'error'>

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
	selectedNames: string[] | null
): StablecoinChartSeriesPayload {
	return buildStablecoinOverviewPayload(params, chart, topToken, {
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
	  }
	| { kind: 'fixed'; presentation: typeof EMPTY_STABLECOIN_PRESENTATION }

const getProStablecoinChartParams = (rawData: StablecoinsChartCacheValue, chain: string) => ({
	chartDataByAssetOrChain: rawData.chartDataByPeggedAsset,
	assetsOrChainsList: rawData.peggedAssetNames,
	filteredIndexes: rawData.chartDataByPeggedAsset.map((_, index) => index),
	issuanceType: 'mcap',
	selectedChain: chain,
	doublecountedIds: rawData.doublecountedIds,
	carryForwardAfterSeriesEnd: true
})

const buildProStablecoinPresentationResult = (
	rawData: StablecoinsChartCacheValue,
	chartType: StablecoinChartType,
	chartPayload: StablecoinChartSeriesPayload
) => {
	const pieSeries =
		chartType === 'pie'
			? prepareRuntimePieChartData({
					data: rawData.pieAssets,
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
			let total = pieSeries.upstreamOthersValue
			for (const peer of pieSeries.peers) total += peer.value
			totalMcapCurrent = pieSeries.peers.length > 0 || pieSeries.upstreamOthersValue > 0 ? total : null
		}
	}

	return {
		chartPayload,
		pieSeries,
		seriesNames: rawData.peggedAssetNames,
		availableSeries: chartPayload.availableSeries ?? [],
		defaultSeries: chartPayload.defaultSeries ?? [],
		totalMcapCurrent
	}
}

export function collectProStablecoinChart({
	rawData,
	chain,
	chartType
}: {
	rawData: StablecoinsChartCacheValue
	chain: string
	chartType: StablecoinChartType
}): ProStablecoinChartCollection {
	const params = getProStablecoinChartParams(rawData, chain)
	if (chartType === 'tokenMcaps' || chartType === 'dominance' || chartType === 'tokenInflows') {
		return {
			kind: 'selectable',
			collection: collectStablecoinOverviewChart(params, chartType),
			rawData,
			chartType
		}
	}
	const chartPayload =
		chartType === 'pie'
			? EMPTY_CHART_PAYLOAD
			: buildProStablecoinOverviewPayload(params, chartType, getTopStablecoinFromLatestPoints(params), null)
	return { kind: 'fixed', presentation: buildProStablecoinPresentationResult(rawData, chartType, chartPayload) }
}

export function buildProStablecoinChartPresentationFromCollection(
	collected: ProStablecoinChartCollection,
	selectionOptions?: StablecoinBreakdownSelectionOptions
) {
	if (collected.kind === 'fixed') return collected.presentation
	const chartPayload = buildStablecoinOverviewPayloadFromCollection(collected.collection, {
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT,
		...selectionOptions
	})
	return buildProStablecoinPresentationResult(collected.rawData, collected.chartType, chartPayload)
}

export function useStablecoinsChartData(
	chain: string,
	chartType: StablecoinChartType,
	enabled = true,
	selectionOptions?: StablecoinBreakdownSelectionOptions
): UseStablecoinsChartDataResult {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const {
		data: rawData,
		isLoading,
		error,
		dataUpdatedAt
	} = useQuery({
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

	const computeSignature = [chain, chartType, dataUpdatedAt].join('::')
	const latestInputRef = useRef({ rawData, chain, chartType })
	latestInputRef.current = { rawData, chain, chartType }
	const { value: collected, isComputing } = useIdleChartComputation({
		enabled: enabled && rawData != null && !isLoading,
		signature: computeSignature,
		compute: () => {
			const input = latestInputRef.current
			return input.rawData
				? collectProStablecoinChart({ rawData: input.rawData, chain: input.chain, chartType: input.chartType })
				: { kind: 'fixed' as const, presentation: EMPTY_STABLECOIN_PRESENTATION }
		},
		emptyValue: { kind: 'fixed' as const, presentation: EMPTY_STABLECOIN_PRESENTATION }
	})
	const presentation = useMemo(
		() => buildProStablecoinChartPresentationFromCollection(collected, selectionOptions),
		[collected, selectionOptions]
	)

	return {
		...presentation,
		isLoading: enabled && (isLoading || (!streamDone && !rawData) || isComputing),
		error
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
			const chains: StablecoinChainInfo[] = []
			for (const chain of data.chains) {
				let tvl = 0
				for (const key in chain.totalCirculatingUSD) {
					const value = chain.totalCirculatingUSD[key]
					if (value !== undefined) tvl += value
				}
				chains.push({
					name: chain.name,
					tvl
				})
			}
			chains.sort((a, b) => b.tvl - a.tvl)
			return chains
		},
		staleTime: 60 * 60 * 1000
	})
}

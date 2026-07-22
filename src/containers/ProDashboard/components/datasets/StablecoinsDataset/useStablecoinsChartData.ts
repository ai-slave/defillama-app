import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo, useRef } from 'react'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import { useIdleChartComputation } from '~/containers/ProDashboard/hooks/useIdleChartComputation'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import {
	buildStablecoinsChartCacheValue,
	type StablecoinsChartCacheValue
} from '~/containers/ProDashboard/server/stablecoinFetchers'
import {
	fetchStablecoinsListViaProxy,
	fetchStablecoinsViaProxy
} from '~/containers/ProDashboard/services/fetchViaProxy'
import { fetchStablecoinAssetsApi, fetchStablecoinChartApi } from '~/containers/Stablecoins/api'
import {
	buildStablecoinOverviewPayload,
	buildStablecoinOverviewPayloadFromCollection,
	collectStablecoinOverviewChart,
	getTopStablecoinFromLatestPoints,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	type StablecoinChartSeriesPayload,
	type StablecoinOverviewChartCollection,
	type StablecoinOverviewChartType
} from '~/containers/Stablecoins/chartSeries'
import type { IBuildStablecoinChartDataParams } from '~/containers/Stablecoins/utils'
import type { StablecoinChartType } from '../../../types'

interface UseStablecoinsChartDataResult {
	chartPayload: StablecoinChartSeriesPayload
	chainsCirculatingValues: Array<{ name: string; value: number }>
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
const EMPTY_STABLECOIN_PRESENTATION = {
	chartPayload: EMPTY_CHART_PAYLOAD,
	chainsCirculatingValues: [] as Array<{ name: string; value: number }>,
	seriesNames: [] as string[],
	availableSeries: [] as string[],
	defaultSeries: [] as string[],
	totalMcapCurrent: null as number | null
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
		usdInflowsName: chart === 'usdInflows' ? 'USD Inflows' : undefined
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

const EMPTY_PRO_STABLECOIN_COLLECTION: ProStablecoinChartCollection = {
	kind: 'fixed',
	presentation: EMPTY_STABLECOIN_PRESENTATION
}

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
	const chainsCirculatingValues =
		chartType === 'pie'
			? preparePieChartData({
					data: rawData.pieAssets,
					sliceIdentifier: 'symbol',
					sliceValue: 'mcap',
					limit: 10
				})
			: []

	let totalMcapCurrent: number | null = null
	if (chartPayload.summary?.totalMcapCurrent != null) {
		totalMcapCurrent = chartPayload.summary.totalMcapCurrent
	} else {
		const lastEntry = chartPayload.dataset.source.at(-1)
		const mcapIndex = chartPayload.dataset.dimensions.indexOf('Mcap')
		if (lastEntry && mcapIndex >= 0 && lastEntry[mcapIndex] != null) {
			totalMcapCurrent = lastEntry[mcapIndex] as number
		} else if (chartType === 'pie') {
			let total = 0
			for (const slice of chainsCirculatingValues) total += slice.value
			totalMcapCurrent = chainsCirculatingValues.length > 0 ? total : null
		}
	}

	return {
		chartPayload,
		chainsCirculatingValues,
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
			: buildProStablecoinOverviewPayload(
					params,
					chartType as StablecoinOverviewChartType,
					getTopStablecoinFromLatestPoints(params),
					null
				)
	return { kind: 'fixed', presentation: buildProStablecoinPresentationResult(rawData, chartType, chartPayload) }
}

export function buildProStablecoinChartPresentationFromCollection(
	collected: ProStablecoinChartCollection,
	selectedNames: string[] | null
) {
	if (collected.kind === 'fixed') return collected.presentation
	const chartPayload = buildStablecoinOverviewPayloadFromCollection(collected.collection, {
		selectedNames,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
	})
	return buildProStablecoinPresentationResult(collected.rawData, collected.chartType, chartPayload)
}

export function buildProStablecoinChartPresentation(args: {
	rawData: StablecoinsChartCacheValue
	chain: string
	chartType: StablecoinChartType
	selectedNames: string[] | null
}) {
	return buildProStablecoinChartPresentationFromCollection(collectProStablecoinChart(args), args.selectedNames)
}

export function useStablecoinsChartData(
	chain: string,
	chartType: StablecoinChartType,
	selectedNames: string[] | null = null,
	enabled = true
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
				return fetchStablecoinsViaProxy(chain, authToken)
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
				? collectProStablecoinChart({
						rawData: input.rawData,
						chain: input.chain,
						chartType: input.chartType
					})
				: EMPTY_PRO_STABLECOIN_COLLECTION
		},
		emptyValue: EMPTY_PRO_STABLECOIN_COLLECTION
	})
	const presentation = useMemo(
		() => buildProStablecoinChartPresentationFromCollection(collected, selectedNames),
		[collected, selectedNames]
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
			const data = authToken ? await fetchStablecoinsListViaProxy(authToken) : await fetchStablecoinAssetsApi()
			const chains = data.chains
			return chains
				.map((chain) => {
					let tvl = 0
					for (const pegType in chain.totalCirculatingUSD) tvl += chain.totalCirculatingUSD[pegType]
					return {
						name: chain.name,
						tvl
					}
				})
				.sort((a: StablecoinChainInfo, b: StablecoinChainInfo) => b.tvl - a.tvl)
		},
		staleTime: 60 * 60 * 1000
	})
}

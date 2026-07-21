import { useQuery } from '@tanstack/react-query'
import { useContext, useRef } from 'react'
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
import {
	fetchStablecoinAssetsApi,
	fetchStablecoinChartApi,
	fetchStablecoinPricesApi,
	fetchStablecoinRatesApi
} from '~/containers/Stablecoins/api'
import {
	buildStablecoinOverviewChartData,
	buildStablecoinOverviewPayloadFromChartData,
	getTopStablecoinFromCollectedValues,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT,
	type StablecoinChartSeriesPayload,
	type StablecoinOverviewChartType
} from '~/containers/Stablecoins/chartSeries'
import type { IBuildStablecoinChartDataParams, IBuildStablecoinChartDataResult } from '~/containers/Stablecoins/utils'
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
	chartData: IBuildStablecoinChartDataResult,
	selectedNames: string[] | null
): StablecoinChartSeriesPayload {
	return buildStablecoinOverviewPayloadFromChartData(params, chart, topToken, chartData, {
		selectedNames,
		seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
	})
}

export function buildProStablecoinChartPresentation({
	rawData,
	chain,
	chartType,
	selectedNames
}: {
	rawData: StablecoinsChartCacheValue
	chain: string
	chartType: StablecoinChartType
	selectedNames: string[] | null
}) {
	let chartPayload = EMPTY_CHART_PAYLOAD
	if (chartType !== 'pie') {
		const filteredIndexes = Object.values(rawData.peggedNameToChartDataIndex) as number[]
		const params = {
			chartDataByAssetOrChain: rawData.chartDataByPeggedAsset,
			assetsOrChainsList: rawData.peggedAssetNames,
			filteredIndexes,
			issuanceType: 'mcap',
			selectedChain: chain,
			doublecountedIds: rawData.doublecountedIds
		}
		const overviewChartType = chartType as StablecoinOverviewChartType
		const chartData = buildStablecoinOverviewChartData(params, overviewChartType)
		chartPayload = buildProStablecoinOverviewPayload(
			params,
			overviewChartType,
			getTopStablecoinFromCollectedValues(chartData),
			chartData,
			selectedNames
		)

		if (chartType === 'usdInflows') {
			// Keep the Pro label stable while reusing the public active-only builder.
			chartPayload = {
				...chartPayload,
				dataset: {
					dimensions: ['timestamp', 'USD Inflows'],
					source: chartPayload.dataset.source.map((row) => [row[0], row[1]])
				},
				charts: chartPayload.charts.map((chart) => ({
					...chart,
					name: 'USD Inflows',
					encode: { x: 0, y: 1 }
				}))
			}
		}
	}

	const chainsCirculatingValues =
		chartType === 'pie'
			? preparePieChartData({
					data: rawData.filteredPeggedAssets,
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

			const [peggedData, chainData, priceData, rateData] = await Promise.all([
				fetchStablecoinAssetsApi(),
				fetchStablecoinChartApi(chain === 'All' ? 'all' : chain),
				fetchStablecoinPricesApi(),
				fetchStablecoinRatesApi()
			])

			return buildStablecoinsChartCacheValue({
				peggedData,
				chainData,
				priceData,
				rateData,
				chain
			})
		},
		staleTime: 5 * 60 * 1000,
		refetchInterval: 5 * 60 * 1000
	})

	const computeSignature = [chain, chartType, dataUpdatedAt, JSON.stringify(selectedNames)].join('::')
	const latestInputRef = useRef({ rawData, chain, chartType, selectedNames })
	latestInputRef.current = { rawData, chain, chartType, selectedNames }
	const { value: presentation, isComputing } = useIdleChartComputation({
		enabled: enabled && rawData != null && !isLoading,
		signature: computeSignature,
		compute: () => {
			const input = latestInputRef.current
			return input.rawData
				? buildProStablecoinChartPresentation({
						rawData: input.rawData,
						chain: input.chain,
						chartType: input.chartType,
						selectedNames: input.selectedNames
					})
				: EMPTY_STABLECOIN_PRESENTATION
		},
		emptyValue: EMPTY_STABLECOIN_PRESENTATION
	})

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

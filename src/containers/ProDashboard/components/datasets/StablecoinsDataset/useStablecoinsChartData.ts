import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { preparePieChartData } from '~/components/ECharts/utils'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { buildStablecoinsChartCacheValue } from '~/containers/ProDashboard/server/stablecoinFetchers'
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
	buildStablecoinBreakdownPayloadPresentation,
	buildStablecoinOverviewPayload,
	getTopStablecoinFromLatestPoints,
	type StablecoinChartSeriesPayload,
	type StablecoinOverviewChartType
} from '~/containers/Stablecoins/chartSeries'
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
		error
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

	const canonicalChartPayload = useMemo<StablecoinChartSeriesPayload>(() => {
		if (!enabled || !rawData || chartType === 'pie') return EMPTY_CHART_PAYLOAD

		const filteredIndexes = Object.values(rawData.peggedNameToChartDataIndex) as number[]
		const params = {
			chartDataByAssetOrChain: rawData.chartDataByPeggedAsset,
			assetsOrChainsList: rawData.peggedAssetNames,
			filteredIndexes,
			issuanceType: 'mcap',
			selectedChain: chain,
			doublecountedIds: rawData.doublecountedIds
		}
		const topToken = getTopStablecoinFromLatestPoints(params)
		return buildStablecoinOverviewPayload(params, chartType as StablecoinOverviewChartType, topToken)
	}, [enabled, rawData, chain, chartType])

	const chartPayload = useMemo<StablecoinChartSeriesPayload>(() => {
		const payload =
			chartType === 'tokenMcaps' || chartType === 'dominance' || chartType === 'tokenInflows'
				? buildStablecoinBreakdownPayloadPresentation({ payload: canonicalChartPayload, selectedNames })
				: canonicalChartPayload
		if (chartType !== 'usdInflows') return payload

		// Keep the Pro label stable while reusing the public active-only builder.
		return {
			...payload,
			dataset: {
				dimensions: ['timestamp', 'USD Inflows'],
				source: payload.dataset.source.map((row) => ({
					timestamp: row.timestamp,
					'USD Inflows': row.Inflows
				}))
			},
			charts: payload.charts.map((chart) => ({
				...chart,
				name: 'USD Inflows',
				encode: { x: 'timestamp', y: 'USD Inflows' }
			}))
		}
	}, [canonicalChartPayload, chartType, selectedNames])

	const chainsCirculatingValues = useMemo(() => {
		if (!enabled || chartType !== 'pie') return []
		const assets = rawData?.filteredPeggedAssets ?? []
		return preparePieChartData({ data: assets, sliceIdentifier: 'symbol', sliceValue: 'mcap', limit: 10 })
	}, [enabled, chartType, rawData?.filteredPeggedAssets])

	const totalMcapCurrent: number | null = useMemo(() => {
		if (chartPayload.summary?.totalMcapCurrent != null) return chartPayload.summary.totalMcapCurrent
		const lastEntry = chartPayload.dataset.source.at(-1)
		if (lastEntry?.Mcap != null) return lastEntry.Mcap as number
		if (chartType !== 'pie') return null
		let total = 0
		for (const slice of chainsCirculatingValues) total += slice.value
		return chainsCirculatingValues.length > 0 ? total : null
	}, [chartPayload, chartType, chainsCirculatingValues])

	return useMemo(
		() => ({
			chartPayload,
			chainsCirculatingValues,
			seriesNames: enabled ? rawData?.peggedAssetNames || [] : [],
			availableSeries: chartPayload.availableSeries ?? [],
			defaultSeries: chartPayload.defaultSeries ?? [],
			totalMcapCurrent,
			isLoading: enabled && (isLoading || (!streamDone && !rawData)),
			error
		}),
		[chartPayload, chainsCirculatingValues, totalMcapCurrent, isLoading, streamDone, rawData, error, enabled]
	)
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

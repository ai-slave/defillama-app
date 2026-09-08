import { skipToken, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { CgChartResponse } from '~/api/coingecko.types'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { formatBarChart, formatLineChart, formatNullableBarChart } from '~/components/ECharts/shared/timeSeries'
import type { ChainAssetsChartDataPoint, ChainAssetsChartResponse } from '~/containers/BridgedTVL/api.types'
import { getBridgeNetFlow } from '~/containers/Bridges/bridgeOverviewVolumeData'
import { useGetBridgeChartDataByChain } from '~/containers/Bridges/queries.client'
import type { BridgeOverviewVolumeChartTuple } from '~/containers/Bridges/types'
import { useGetStabelcoinsChartDataByChain } from '~/containers/Stablecoins/queries.client'
import { feeRevenueMetrics } from '~/metrics/feesRevenue'
import { getFeeRevenueChainChartApiParams } from '~/metrics/routeSemantics'
import { fetchJson } from '~/utils/async'
import type { ChainChartLabels } from './constants'
import { buildChainTvlChartState } from './tvlChart'
import type { ChainOverviewChartData } from './types'

export const normalizeActivityChart = (values: Array<[number, number]> | null): Array<[number, number]> | null => {
	if (!values?.length) return null
	return values
}

const buildChainChartApiUrl = (params: Record<string, string | undefined>) => {
	const searchParams = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value != null) {
			searchParams.set(key, value)
		}
	}
	return `/api/public/chains/charts?${searchParams.toString()}`
}

const chainFeesMetric = feeRevenueMetrics.chainFees
const chainRevenueMetric = feeRevenueMetrics.chainRevenue
const appFeesMetric = feeRevenueMetrics.appFees
const appRevenueMetric = feeRevenueMetrics.appRevenue

type CoingeckoChartData = {
	prices: Array<[number, number]>
	mcaps?: Array<[number, number]>
	volumes?: Array<[number, number]>
}

type DenominationPriceHistory = {
	conversionPrices: Record<string, number>
	canConvert: boolean
	priceChart: Array<[number, number]>
	mcaps: Array<[number, number]> | undefined
	volumes: Array<[number, number]> | undefined
}

export function buildDenominationPriceHistory(data: CoingeckoChartData): DenominationPriceHistory {
	const conversionPrices: Record<string, number> = {}
	let activeConversionPriceCount = 0
	for (const [date, value] of data.prices) {
		const hasConversionPrice = conversionPrices[date] !== undefined
		if (value === 0) {
			if (hasConversionPrice) {
				delete conversionPrices[date]
				activeConversionPriceCount--
			}
			continue
		}
		if (!hasConversionPrice) activeConversionPriceCount++
		conversionPrices[date] = value
	}

	return {
		conversionPrices,
		canConvert: activeConversionPriceCount > 0,
		priceChart: data.prices,
		mcaps: data.mcaps,
		volumes: data.volumes
	}
}

async function fetchDenominationPriceHistory(geckoId: string): Promise<DenominationPriceHistory | null> {
	const response = await fetchJson<CgChartResponse>(
		`/api/public/tokens/charts/coingecko/${encodeURIComponent(geckoId)}?timeframe=MAX`
	)
	const prices = response.data?.prices
	if (!prices?.length) return null

	const priceHistory = buildDenominationPriceHistory({
		prices,
		...(response.data?.mcaps !== undefined ? { mcaps: response.data.mcaps } : {}),
		...(response.data?.volumes !== undefined ? { volumes: response.data.volumes } : {})
	})
	return priceHistory.priceChart.length > 0 ? priceHistory : null
}

export function getNetInflowsSeries(data: Array<BridgeOverviewVolumeChartTuple>): Array<[number, number | null]> {
	const series: Array<[number, number | null]> = []
	for (const [date, deposits, signedWithdrawals] of data) {
		const netFlow = getBridgeNetFlow({
			depositUSD: deposits,
			withdrawUSD: signedWithdrawals == null ? null : -signedWithdrawals
		})
		series.push([date, netFlow])
	}
	return series
}

export function buildBridgedTvlChart(
	bridgedTvlData: Array<ChainAssetsChartDataPoint>,
	isGovTokensEnabled: boolean | undefined
): Array<[number, number]> {
	const chart: Array<[number, number]> = []
	for (const item of bridgedTvlData) {
		const timestampMs = Math.floor(item.timestamp / 86_400) * 86_400 * 1e3
		chart.push([timestampMs, item.data.total + (isGovTokensEnabled ? (item.data.ownTokens ?? 0) : 0)])
	}
	return chart
}

export const useFetchChainChartData = ({
	denomination,
	selectedChain,
	tvlChart,
	tvlChartSummary,
	extraTvlCharts,
	tvlSettings,
	chainGeckoId,
	gasTokenGeckoId,
	toggledCharts,
	groupBy
}: {
	denomination: string
	selectedChain: string
	tvlChart: Array<[number, number]>
	tvlChartSummary: {
		totalValueUSD: number | null
		tvlPrevDay: number | null
		valueChange24hUSD: number | null
		change24h: number | null
	}
	extraTvlCharts: Record<string, Record<string, number>>
	tvlSettings: Record<string, boolean>
	chainGeckoId: string | null
	gasTokenGeckoId: string | null
	toggledCharts: Array<ChainChartLabels>
	groupBy: ChartTimeGroupingWithCumulative
}) => {
	const toggledChartsSet = useMemo(() => new Set(toggledCharts), [toggledCharts])
	const [nowMs] = useState(() => Date.now())

	const denominationGeckoId = denomination !== 'USD' ? gasTokenGeckoId : null
	const isDenominationEnabled = !!denominationGeckoId
	const isTokenPriceEnabled = toggledChartsSet.has('Token Price')
	const isTokenMcapEnabled = toggledChartsSet.has('Token Mcap')
	const isTokenVolumeEnabled = toggledChartsSet.has('Token Volume')
	const tokenGeckoId = isTokenPriceEnabled || isTokenMcapEnabled || isTokenVolumeEnabled ? chainGeckoId : null

	// date in the chart is in ms
	const { data: denominationPriceHistory = null, isLoading: fetchingDenominationPriceHistory } = useQuery({
		queryKey: ['chain-overview', 'price-history', denominationGeckoId],
		queryFn: denominationGeckoId ? () => fetchDenominationPriceHistory(denominationGeckoId) : skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!denominationGeckoId
	})

	// Official-token valuation stays separate from gas-token conversion (e.g. ARB versus ETH).
	const { data: tokenPriceHistory = null, isLoading: fetchingTokenPriceHistory } = useQuery({
		queryKey: ['chain-overview', 'price-history', tokenGeckoId],
		queryFn: tokenGeckoId ? () => fetchDenominationPriceHistory(tokenGeckoId) : skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!tokenGeckoId
	})

	const isChainFeesEnabled = toggledChartsSet.has(chainFeesMetric.label)
	const { data: chainFeesDataChart = null, isLoading: fetchingChainFees } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', chainFeesMetric.chainOverview.queryKey, selectedChain],
		queryFn: () =>
			fetchJson(
				buildChainChartApiUrl(
					getFeeRevenueChainChartApiParams({
						metric: chainFeesMetric,
						chain: selectedChain
					})
				)
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainFeesEnabled
	})

	const isChainRevenueEnabled = toggledChartsSet.has(chainRevenueMetric.label)
	const { data: chainRevenueDataChart = null, isLoading: fetchingChainRevenue } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', chainRevenueMetric.chainOverview.queryKey, selectedChain],
		queryFn: () =>
			fetchJson(
				buildChainChartApiUrl(
					getFeeRevenueChainChartApiParams({
						metric: chainRevenueMetric,
						chain: selectedChain
					})
				)
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainRevenueEnabled
	})

	const isDexVolumeEnabled = toggledChartsSet.has('DEXs Volume')
	const { data: dexVolumeDataChart = null, isLoading: fetchingDexVolume } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', 'dex-volume', selectedChain],
		queryFn: () =>
			fetchJson(buildChainChartApiUrl({ kind: 'adapter-chain', chain: selectedChain, adapterType: 'dexs' })),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isDexVolumeEnabled
	})

	const isPerpsVolumeEnabled = toggledChartsSet.has('Perps Volume')
	const { data: perpsVolumeDataChart = null, isLoading: fetchingPerpVolume } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', 'perp-volume', selectedChain],
		queryFn: () =>
			fetchJson(buildChainChartApiUrl({ kind: 'adapter-chain', chain: selectedChain, adapterType: 'derivatives' })),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isPerpsVolumeEnabled
	})

	const isChainAppFeesEnabled = toggledChartsSet.has(appFeesMetric.label)
	const { data: chainAppFeesDataChart = null, isLoading: fetchingChainAppFees } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', appFeesMetric.chainOverview.queryKey, selectedChain],
		queryFn: () =>
			fetchJson(
				buildChainChartApiUrl(
					getFeeRevenueChainChartApiParams({
						metric: appFeesMetric,
						chain: selectedChain
					})
				)
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainAppFeesEnabled
	})

	const isChainAppRevenueEnabled = toggledChartsSet.has(appRevenueMetric.label)
	const { data: chainAppRevenueDataChart = null, isLoading: fetchingChainAppRevenue } = useQuery<
		Array<[number, number]>
	>({
		queryKey: ['chain-overview', appRevenueMetric.chainOverview.queryKey, selectedChain],
		queryFn: () =>
			fetchJson(
				buildChainChartApiUrl(
					getFeeRevenueChainChartApiParams({
						metric: appRevenueMetric,
						chain: selectedChain
					})
				)
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainAppRevenueEnabled
	})

	const { data: stablecoinsChartData = null, isLoading: fetchingStablecoinsChartDataByChain } =
		useGetStabelcoinsChartDataByChain(toggledChartsSet.has('Stablecoins Mcap') ? selectedChain : undefined)

	const { data: inflowsChartData = null, isLoading: fetchingInflowsChartData } = useGetBridgeChartDataByChain(
		toggledChartsSet.has('Net Inflows') ? selectedChain : undefined
	)

	const isActiveAddressesEnabled = toggledChartsSet.has('Active Addresses')
	const { data: activeAddressesData = null, isLoading: fetchingActiveAddresses } = useQuery<Array<
		[number, number]
	> | null>({
		queryKey: ['chain-overview', 'active-addresses', selectedChain],
		queryFn: () =>
			fetchJson<Array<[number, number]>>(
				buildChainChartApiUrl({
					kind: 'adapter-protocol',
					entity: 'chain',
					adapterType: 'active-users',
					protocol: selectedChain
				})
			)
				.then((values) => normalizeActivityChart(values))
				.catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isActiveAddressesEnabled
	})
	const isNewAddressesEnabled = toggledChartsSet.has('New Addresses')
	const { data: newAddressesData = null, isLoading: fetchingNewAddresses } = useQuery<Array<[number, number]> | null>({
		queryKey: ['chain-overview', 'new-addresses', selectedChain],
		queryFn: () =>
			fetchJson<Array<[number, number]>>(
				buildChainChartApiUrl({
					kind: 'adapter-protocol',
					entity: 'chain',
					adapterType: 'new-users',
					protocol: selectedChain
				})
			)
				.then((values) => normalizeActivityChart(values))
				.catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isNewAddressesEnabled
	})
	const isTransactionsEnabled = toggledChartsSet.has('Transactions')
	const { data: transactionsData = null, isLoading: fetchingTransactions } = useQuery<Array<[number, number]> | null>({
		queryKey: ['chain-overview', 'transactions', selectedChain],
		queryFn: () =>
			fetchJson<Array<[number, number]>>(
				buildChainChartApiUrl({
					kind: 'adapter-protocol',
					entity: 'chain',
					adapterType: 'active-users',
					protocol: selectedChain,
					dataType: 'dailyTransactionsCount'
				})
			)
				.then((values) => normalizeActivityChart(values))
				.catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isTransactionsEnabled
	})
	const isBridgedTvlEnabled = toggledChartsSet.has('Bridged TVL')
	const { data: bridgedTvlData = null, isLoading: fetchingBridgedTvlData } = useQuery<ChainAssetsChartResponse>({
		queryKey: ['chain-overview', 'bridged-tvl', selectedChain],
		queryFn: isBridgedTvlEnabled
			? () => fetchJson<ChainAssetsChartResponse>(buildChainChartApiUrl({ kind: 'bridged-tvl', chain: selectedChain }))
			: skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isBridgedTvlEnabled
	})

	const isRaisesEnabled = toggledChartsSet.has('Raises')
	const { data: raisesData = null, isLoading: fetchingRaises } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', 'raises'],
		queryFn: () => fetchJson(buildChainChartApiUrl({ kind: 'raises' })),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isRaisesEnabled
	})

	const isChainIncentivesEnabled = toggledChartsSet.has('Token Incentives')
	const { data: chainIncentivesData = null, isLoading: fetchingChainIncentives } = useQuery<Array<
		[number, number]
	> | null>({
		queryKey: ['chain-overview', 'token-incentives', selectedChain],
		queryFn: () =>
			fetchJson<Array<[number, number]>>(
				buildChainChartApiUrl({ kind: 'token-incentives', protocol: selectedChain })
			).catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainIncentivesEnabled
	})

	const { finalTvlChart, totalValueUSD, valueChange24hUSD, change24h, isGovTokensEnabled } = useMemo(() => {
		return buildChainTvlChartState({ tvlChart, tvlChartSummary, extraTvlCharts, tvlSettings, nowMs })
	}, [tvlChart, tvlChartSummary, extraTvlCharts, tvlSettings, nowMs])

	const chartData = useMemo(() => {
		const charts: ChainOverviewChartData = {}

		const loadingCharts = []

		if (fetchingDenominationPriceHistory) {
			loadingCharts.push('Denomination Price')
		}

		if (fetchingTokenPriceHistory) {
			loadingCharts.push('Token Price')
		}

		if (fetchingChainFees) {
			loadingCharts.push(chainFeesMetric.label)
		}

		if (fetchingChainRevenue) {
			loadingCharts.push(chainRevenueMetric.label)
		}

		if (fetchingDexVolume) {
			loadingCharts.push('DEXs Volume')
		}
		if (fetchingPerpVolume) {
			loadingCharts.push('Perps Volume')
		}

		if (fetchingChainAppFees) {
			loadingCharts.push(appFeesMetric.label)
		}

		if (fetchingChainAppRevenue) {
			loadingCharts.push(appRevenueMetric.label)
		}

		if (fetchingInflowsChartData) {
			loadingCharts.push('Net Inflows')
		}

		if (fetchingStablecoinsChartDataByChain) {
			loadingCharts.push('Stablecoins Mcap')
		}

		if (fetchingActiveAddresses) {
			loadingCharts.push('Active Addresses')
		}

		if (fetchingNewAddresses) {
			loadingCharts.push('New Addresses')
		}

		if (fetchingTransactions) {
			loadingCharts.push('Transactions')
		}

		if (fetchingBridgedTvlData) {
			loadingCharts.push('Bridged TVL')
		}

		if (fetchingRaises) {
			loadingCharts.push('Raises')
		}

		if (fetchingChainIncentives) {
			loadingCharts.push('Token Incentives')
		}

		if (loadingCharts.length > 0) {
			return {
				finalCharts: {},
				valueSymbol: denomination === 'USD' ? '$' : denomination,
				loadingCharts: loadingCharts.join(', ').toLowerCase(),
				failedMetrics: []
			}
		}
		const canConvertDenomination = isDenominationEnabled && denominationPriceHistory?.canConvert === true
		const denominationPrices = canConvertDenomination ? denominationPriceHistory.conversionPrices : null

		if (toggledChartsSet.has('TVL')) {
			const chartName: ChainChartLabels = 'TVL'
			charts[chartName] = formatLineChart({
				data: finalTvlChart,
				groupBy,
				denominationPriceHistory: denominationPrices,
				dateInMs: true
			})
		}

		if (isChainFeesEnabled && chainFeesDataChart) {
			const chartName: ChainChartLabels = chainFeesMetric.label
			charts[chartName] = formatBarChart({
				data: chainFeesDataChart,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (isChainRevenueEnabled && chainRevenueDataChart) {
			const chartName: ChainChartLabels = chainRevenueMetric.label
			charts[chartName] = formatBarChart({
				data: chainRevenueDataChart,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (isDexVolumeEnabled && dexVolumeDataChart) {
			const chartName: ChainChartLabels = 'DEXs Volume'
			charts[chartName] = formatBarChart({
				data: dexVolumeDataChart,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (isPerpsVolumeEnabled && perpsVolumeDataChart) {
			const chartName: ChainChartLabels = 'Perps Volume'
			charts[chartName] = formatBarChart({
				data: perpsVolumeDataChart,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (isChainAppFeesEnabled && chainAppFeesDataChart) {
			const chartName: ChainChartLabels = appFeesMetric.label
			charts[chartName] = formatBarChart({
				data: chainAppFeesDataChart,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (isChainAppRevenueEnabled && chainAppRevenueDataChart) {
			const chartName: ChainChartLabels = appRevenueMetric.label
			charts[chartName] = formatBarChart({
				data: chainAppRevenueDataChart,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (isTokenPriceEnabled && tokenPriceHistory?.priceChart) {
			const chartName: ChainChartLabels = 'Token Price'
			charts[chartName] = formatLineChart({
				data: tokenPriceHistory.priceChart,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		}

		if (isTokenMcapEnabled && tokenPriceHistory?.mcaps) {
			const chartName: ChainChartLabels = 'Token Mcap'
			charts[chartName] = formatLineChart({
				data: tokenPriceHistory?.mcaps,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		}

		if (isTokenVolumeEnabled && tokenPriceHistory?.volumes) {
			const chartName: ChainChartLabels = 'Token Volume'
			charts[chartName] = formatBarChart({
				data: tokenPriceHistory?.volumes,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		}

		if (toggledChartsSet.has('Net Inflows') && inflowsChartData) {
			const chartName: ChainChartLabels = 'Net Inflows'
			charts[chartName] = formatNullableBarChart({
				data: getNetInflowsSeries(inflowsChartData),
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		if (toggledChartsSet.has('Stablecoins Mcap') && stablecoinsChartData) {
			const chartName: ChainChartLabels = 'Stablecoins Mcap'
			charts[chartName] = formatLineChart({
				data: stablecoinsChartData,
				groupBy,
				denominationPriceHistory: denominationPrices,
				dateInMs: true
			})
		}

		if (isActiveAddressesEnabled && activeAddressesData) {
			const chartName: ChainChartLabels = 'Active Addresses'
			charts[chartName] = formatBarChart({
				data: activeAddressesData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: false
			})
		}

		if (isNewAddressesEnabled && newAddressesData) {
			const chartName: ChainChartLabels = 'New Addresses'
			charts[chartName] = formatBarChart({
				data: newAddressesData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: false
			})
		}

		if (isTransactionsEnabled && transactionsData) {
			const chartName: ChainChartLabels = 'Transactions'
			charts[chartName] = formatBarChart({
				data: transactionsData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: false
			})
		}

		if (isBridgedTvlEnabled && bridgedTvlData) {
			const chartName: ChainChartLabels = 'Bridged TVL'
			charts[chartName] = formatLineChart({
				data: buildBridgedTvlChart(bridgedTvlData, isGovTokensEnabled),
				groupBy,
				denominationPriceHistory: denominationPrices,
				dateInMs: true
			})
		}

		if (isRaisesEnabled && raisesData) {
			const chartName: ChainChartLabels = 'Raises'
			charts[chartName] = formatBarChart({
				data: raisesData,
				groupBy,
				denominationPriceHistory: null,
				dateInMs: true
			})
		}

		if (isChainIncentivesEnabled && chainIncentivesData) {
			const chartName: ChainChartLabels = 'Token Incentives'
			charts[chartName] = formatBarChart({
				data: chainIncentivesData,
				groupBy,
				denominationPriceHistory: denominationPrices
			})
		}

		const failedMetrics = toggledCharts.filter((chartLabel) => {
			const isTokenMetric = chartLabel === 'Token Price' || chartLabel === 'Token Mcap' || chartLabel === 'Token Volume'
			// Token metrics are intentionally not fetched when no chain gecko id is available.
			if (isTokenMetric && !tokenGeckoId) return false
			return !Object.hasOwn(charts, chartLabel)
		})
		return {
			finalCharts: charts,
			valueSymbol: canConvertDenomination ? denomination : '$',
			loadingCharts: '',
			failedMetrics
		}
	}, [
		toggledChartsSet,
		isGovTokensEnabled,
		fetchingDenominationPriceHistory,
		fetchingTokenPriceHistory,
		tokenPriceHistory,
		tokenGeckoId,
		isDenominationEnabled,
		denominationPriceHistory,
		fetchingChainFees,
		isChainFeesEnabled,
		chainFeesDataChart,
		fetchingChainRevenue,
		isChainRevenueEnabled,
		chainRevenueDataChart,
		fetchingDexVolume,
		isDexVolumeEnabled,
		dexVolumeDataChart,
		fetchingPerpVolume,
		isPerpsVolumeEnabled,
		perpsVolumeDataChart,
		fetchingChainAppFees,
		isChainAppFeesEnabled,
		chainAppFeesDataChart,
		fetchingChainAppRevenue,
		isChainAppRevenueEnabled,
		chainAppRevenueDataChart,
		isTokenPriceEnabled,
		isTokenMcapEnabled,
		isTokenVolumeEnabled,
		fetchingInflowsChartData,
		inflowsChartData,
		fetchingStablecoinsChartDataByChain,
		stablecoinsChartData,
		fetchingActiveAddresses,
		isActiveAddressesEnabled,
		activeAddressesData,
		fetchingNewAddresses,
		isNewAddressesEnabled,
		newAddressesData,
		fetchingTransactions,
		isTransactionsEnabled,
		transactionsData,
		fetchingBridgedTvlData,
		isBridgedTvlEnabled,
		bridgedTvlData,
		fetchingRaises,
		isRaisesEnabled,
		raisesData,
		fetchingChainIncentives,
		isChainIncentivesEnabled,
		chainIncentivesData,
		finalTvlChart,
		denomination,
		groupBy,
		toggledCharts
	])

	return {
		isFetchingChartData: !!chartData.loadingCharts,
		finalCharts: chartData.finalCharts,
		valueSymbol: chartData.valueSymbol,
		failedMetrics: chartData.failedMetrics,
		totalValueUSD,
		valueChange24hUSD,
		change24h
	}
}

// todo dev metrics, commits charts

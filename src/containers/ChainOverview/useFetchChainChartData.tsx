import { skipToken, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { CgChartResponse } from '~/api/coingecko.types'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import type { ChainAssetsChartResponse } from '~/containers/BridgedTVL/api.types'
import { useGetBridgeChartDataByChain } from '~/containers/Bridges/queries.client'
import { useGetStabelcoinsChartDataByChain } from '~/containers/Stablecoins/queries.client'
import { feeRevenueMetrics } from '~/metrics/feesRevenue'
import { fetchJson } from '~/utils/async'
import {
	buildChainChartData,
	buildDenominationPriceHistory,
	type DenominationPriceHistory,
	getChainChartApiUrl,
	getChainChartGeckoIds,
	normalizeActivityChart
} from './chainChartData'
import type { ChainChartLabels } from './constants'
import { buildChainTvlChartState } from './tvlChart'
import type { IChainOverviewData } from './types'

const chainFeesMetric = feeRevenueMetrics.chainFees
const chainRevenueMetric = feeRevenueMetrics.chainRevenue
const chainHoldersRevenueMetric = feeRevenueMetrics.chainHoldersRevenue
const appFeesMetric = feeRevenueMetrics.appFees
const appRevenueMetric = feeRevenueMetrics.appRevenue

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
	tvlChartSummary: IChainOverviewData['tvlChartSummary']
	extraTvlCharts: Record<string, Record<string, number>>
	tvlSettings: Record<string, boolean>
	chainGeckoId: string | null
	gasTokenGeckoId: string | null
	toggledCharts: Array<ChainChartLabels>
	groupBy: ChartTimeGroupingWithCumulative
}) => {
	const toggledChartsSet = useMemo(() => new Set(toggledCharts), [toggledCharts])

	const { denominationGeckoId, tokenGeckoId } = getChainChartGeckoIds({
		denomination,
		gasTokenGeckoId,
		chainGeckoId,
		toggledCharts: toggledChartsSet
	})

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
		queryFn: () => fetchJson(getChainChartApiUrl(chainFeesMetric.label, selectedChain)),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainFeesEnabled
	})

	const isChainRevenueEnabled = toggledChartsSet.has(chainRevenueMetric.label)
	const { data: chainRevenueDataChart = null, isLoading: fetchingChainRevenue } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', chainRevenueMetric.chainOverview.queryKey, selectedChain],
		queryFn: () => fetchJson(getChainChartApiUrl(chainRevenueMetric.label, selectedChain)),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainRevenueEnabled
	})
	const { data: holdersRevenueDataChart = null, isLoading: fetchingHoldersRevenue } = useQuery<Array<[number, number]>>(
		{
			queryKey: ['chain-overview', chainHoldersRevenueMetric.chainOverview.queryKey, selectedChain],
			queryFn: () => fetchJson(getChainChartApiUrl(chainHoldersRevenueMetric.label, selectedChain)),
			staleTime: 60 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0,
			enabled: toggledChartsSet.has(chainHoldersRevenueMetric.label)
		}
	)

	const isDexVolumeEnabled = toggledChartsSet.has('DEXs Volume')
	const { data: dexVolumeDataChart = null, isLoading: fetchingDexVolume } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', 'dex-volume', selectedChain],
		queryFn: () => fetchJson(getChainChartApiUrl('DEXs Volume', selectedChain)),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isDexVolumeEnabled
	})

	const isPerpsVolumeEnabled = toggledChartsSet.has('Perps Volume')
	const { data: perpsVolumeDataChart = null, isLoading: fetchingPerpVolume } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', 'perp-volume', selectedChain],
		queryFn: () => fetchJson(getChainChartApiUrl('Perps Volume', selectedChain)),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isPerpsVolumeEnabled
	})

	const isChainAppFeesEnabled = toggledChartsSet.has(appFeesMetric.label)
	const { data: chainAppFeesDataChart = null, isLoading: fetchingChainAppFees } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', appFeesMetric.chainOverview.queryKey, selectedChain],
		queryFn: () => fetchJson(getChainChartApiUrl(appFeesMetric.label, selectedChain)),
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
		queryFn: () => fetchJson(getChainChartApiUrl(appRevenueMetric.label, selectedChain)),
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
			fetchJson<Array<[number, number]>>(getChainChartApiUrl('Active Addresses', selectedChain))
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
			fetchJson<Array<[number, number]>>(getChainChartApiUrl('New Addresses', selectedChain))
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
			fetchJson<Array<[number, number]>>(getChainChartApiUrl('Transactions', selectedChain))
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
			? () => fetchJson<ChainAssetsChartResponse>(getChainChartApiUrl('Bridged TVL', selectedChain))
			: skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isBridgedTvlEnabled
	})

	const isRaisesEnabled = toggledChartsSet.has('Raises')
	const { data: raisesData = null, isLoading: fetchingRaises } = useQuery<Array<[number, number]>>({
		queryKey: ['chain-overview', 'raises'],
		queryFn: () => fetchJson(getChainChartApiUrl('Raises', selectedChain)),
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
			fetchJson<Array<[number, number]>>(getChainChartApiUrl('Token Incentives', selectedChain)).catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isChainIncentivesEnabled
	})

	const { finalTvlChart, totalValueUSD, valueChange24hUSD, change24h, isGovTokensEnabled } = useMemo(() => {
		// The settings-adjusted change is measured on the day the server's summary was, wherever the data came from.
		return buildChainTvlChartState({
			tvlChart,
			tvlChartSummary,
			extraTvlCharts,
			tvlSettings,
			nowMs: tvlChartSummary.computedAtMs
		})
	}, [tvlChart, tvlChartSummary, extraTvlCharts, tvlSettings])

	const chartData = useMemo(() => {
		const loadingCharts: Array<string> = []
		if (fetchingDenominationPriceHistory) loadingCharts.push('Denomination Price')
		if (fetchingTokenPriceHistory) loadingCharts.push('Token Price')
		if (fetchingChainFees) loadingCharts.push(chainFeesMetric.label)
		if (fetchingChainRevenue) loadingCharts.push(chainRevenueMetric.label)
		if (fetchingHoldersRevenue) loadingCharts.push(chainHoldersRevenueMetric.label)
		if (fetchingDexVolume) loadingCharts.push('DEXs Volume')
		if (fetchingPerpVolume) loadingCharts.push('Perps Volume')
		if (fetchingChainAppFees) loadingCharts.push(appFeesMetric.label)
		if (fetchingChainAppRevenue) loadingCharts.push(appRevenueMetric.label)
		if (fetchingInflowsChartData) loadingCharts.push('Net Inflows')
		if (fetchingStablecoinsChartDataByChain) loadingCharts.push('Stablecoins Mcap')
		if (fetchingActiveAddresses) loadingCharts.push('Active Addresses')
		if (fetchingNewAddresses) loadingCharts.push('New Addresses')
		if (fetchingTransactions) loadingCharts.push('Transactions')
		if (fetchingBridgedTvlData) loadingCharts.push('Bridged TVL')
		if (fetchingRaises) loadingCharts.push('Raises')
		if (fetchingChainIncentives) loadingCharts.push('Token Incentives')
		return buildChainChartData({
			denomination,
			denominationGeckoId,
			tokenGeckoId,
			toggledCharts,
			groupBy,
			finalTvlChart,
			isGovTokensEnabled,
			loadingCharts,
			sources: {
				denominationPriceHistory,
				tokenPriceHistory,
				chainFees: chainFeesDataChart,
				chainRevenue: chainRevenueDataChart,
				holdersRevenue: holdersRevenueDataChart,
				dexVolume: dexVolumeDataChart,
				perpsVolume: perpsVolumeDataChart,
				appFees: chainAppFeesDataChart,
				appRevenue: chainAppRevenueDataChart,
				inflows: inflowsChartData,
				stablecoins: stablecoinsChartData,
				activeAddresses: activeAddressesData,
				newAddresses: newAddressesData,
				transactions: transactionsData,
				bridgedTvl: bridgedTvlData,
				raises: raisesData,
				incentives: chainIncentivesData
			}
		})
	}, [
		fetchingDenominationPriceHistory,
		fetchingTokenPriceHistory,
		fetchingChainFees,
		fetchingChainRevenue,
		fetchingHoldersRevenue,
		fetchingDexVolume,
		fetchingPerpVolume,
		fetchingChainAppFees,
		fetchingChainAppRevenue,
		fetchingInflowsChartData,
		fetchingStablecoinsChartDataByChain,
		fetchingActiveAddresses,
		fetchingNewAddresses,
		fetchingTransactions,
		fetchingBridgedTvlData,
		fetchingRaises,
		fetchingChainIncentives,
		denomination,
		denominationGeckoId,
		tokenGeckoId,
		toggledCharts,
		groupBy,
		finalTvlChart,
		isGovTokensEnabled,
		denominationPriceHistory,
		tokenPriceHistory,
		chainFeesDataChart,
		chainRevenueDataChart,
		holdersRevenueDataChart,
		dexVolumeDataChart,
		perpsVolumeDataChart,
		chainAppFeesDataChart,
		chainAppRevenueDataChart,
		inflowsChartData,
		stablecoinsChartData,
		activeAddressesData,
		newAddressesData,
		transactionsData,
		bridgedTvlData,
		raisesData,
		chainIncentivesData
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

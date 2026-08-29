import { skipToken, useQuery } from '@tanstack/react-query'
import type { CgChartResponse } from '~/api/coingecko.types'
import { fetchJson } from '~/utils/async'
import { DEFAULT_PRICE_CHART_TIMEFRAME, type PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import { buildTokenOverviewRawChartData, type TokenOverviewChartLabel, type TokenOverviewData } from './tokenOverview'

async function fetchTokenOverviewChart(
	geckoId: string,
	timeframe: PriceChartTimeframe
): Promise<CgChartResponse | null> {
	return fetchJson<CgChartResponse | null>(
		`/api/public/tokens/charts/coingecko/${encodeURIComponent(geckoId)}?timeframe=${timeframe}`
	)
}

async function fetchTokenOverviewTotalSupply(geckoId: string): Promise<number | null> {
	return fetchJson<{ totalSupply: number | null }>(
		`/api/public/tokens/charts/coingecko/${encodeURIComponent(geckoId)}?kind=supply`
	).then((response) => response?.totalSupply ?? null)
}

export function useFetchTokenOverviewChartData({
	geckoId,
	overview,
	activeCharts,
	timeframe,
	enabled
}: {
	geckoId: string | null
	overview: TokenOverviewData
	activeCharts: TokenOverviewChartLabel[]
	timeframe: PriceChartTimeframe
	enabled: boolean
}) {
	const prefetchedChartData = timeframe === DEFAULT_PRICE_CHART_TIMEFRAME ? overview.rawChartData : {}
	const missingCharts = activeCharts.filter((chart) => !prefetchedChartData[chart]?.length)
	const shouldFetchChart = Boolean(geckoId) && enabled && missingCharts.length > 0
	const shouldFetchTotalSupply =
		Boolean(geckoId) &&
		enabled &&
		missingCharts.includes('FDV') &&
		overview.marketData.maxSupply == null &&
		overview.marketData.totalSupply == null

	const {
		data: chartData = null,
		isLoading: loadingChartData,
		isError: isChartError,
		isFetching: isFetchingChartData
	} = useQuery({
		queryKey: ['token-overview', 'chart', geckoId, timeframe],
		queryFn: geckoId ? () => fetchTokenOverviewChart(geckoId, timeframe) : skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: shouldFetchChart
	})

	const {
		data: totalSupply = null,
		isLoading: loadingTotalSupply,
		isError: isTotalSupplyError,
		isFetching: isFetchingTotalSupply
	} = useQuery({
		queryKey: ['token-overview', 'total-supply', geckoId],
		queryFn: geckoId ? () => fetchTokenOverviewTotalSupply(geckoId) : skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: shouldFetchTotalSupply
	})

	return {
		rawChartData: chartData
			? {
					...prefetchedChartData,
					...buildTokenOverviewRawChartData({
						chart: chartData,
						totalSupply: overview.marketData.maxSupply ?? overview.marketData.totalSupply ?? totalSupply,
						includeCharts: missingCharts
					})
				}
			: prefetchedChartData,
		isLoading: loadingChartData || loadingTotalSupply,
		isFetching: isFetchingChartData || isFetchingTotalSupply,
		isError: isChartError || isTotalSupplyError
	}
}

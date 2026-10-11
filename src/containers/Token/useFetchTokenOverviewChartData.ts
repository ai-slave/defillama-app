import { skipToken, useQuery } from '@tanstack/react-query'
import type { CgChartResponse } from '~/api/coingecko.types'
import { fetchJson } from '~/utils/async'
import { DEFAULT_PRICE_CHART_TIMEFRAME, type PriceChartTimeframe } from '~/utils/priceChartTimeframes'
import { mergeFailedReads, queryReadFailed } from '~/utils/query'
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
	activeCharts: Array<TokenOverviewChartLabel>
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

	const chartQuery = useQuery({
		queryKey: ['token-overview', 'chart', geckoId, timeframe],
		queryFn: geckoId ? () => fetchTokenOverviewChart(geckoId, timeframe) : skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: shouldFetchChart
	})

	const supplyQuery = useQuery({
		queryKey: ['token-overview', 'total-supply', geckoId],
		queryFn: geckoId ? () => fetchTokenOverviewTotalSupply(geckoId) : skipToken,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: shouldFetchTotalSupply
	})

	return {
		rawChartData: chartQuery.data
			? {
					...prefetchedChartData,
					...buildTokenOverviewRawChartData({
						chart: chartQuery.data,
						totalSupply: overview.marketData.maxSupply ?? overview.marketData.totalSupply ?? supplyQuery.data ?? null,
						includeCharts: missingCharts
					})
				}
			: prefetchedChartData,
		isLoading: chartQuery.isLoading || supplyQuery.isLoading,
		// A disabled query keeps its last error, so only reads the current selection needs count: a supply failure for
		// FDV must not stand in for Market Cap once the reader swaps one for the other.
		failedRead: mergeFailedReads([
			shouldFetchChart && queryReadFailed(chartQuery) ? chartQuery : null,
			shouldFetchTotalSupply && queryReadFailed(supplyQuery) ? supplyQuery : null
		])
	}
}

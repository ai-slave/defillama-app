import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchJson } from '~/utils/async'
import type { RWAPerpsChartMetric, RWAPerpsChartSource } from './chartBreakdown'
import { toRwaMultiSeriesChartDataset, type RWAChartDataset, type RWAPositionalChartDataset } from './chartDataset'

const RWA_PERPS_CHART_API = '/api/public/rwa/perps'
const EMPTY_DATASET: RWAPositionalChartDataset = { source: [], dimensions: ['timestamp'] }
const STALE_TIME = 60 * 60 * 1000

export type RwaPerpsChartDatasetRequest = {
	source: RWAPerpsChartSource
	metric: RWAPerpsChartMetric
	includeCex: boolean
	enabled: boolean
}

/** The public route and query for a perps chart source; the server key for volume is the 24h one. */
export function getRwaPerpsChartUrl({
	source,
	metric,
	includeCex
}: Omit<RwaPerpsChartDatasetRequest, 'enabled'>): string {
	const searchParams = new URLSearchParams()
	if (source.kind === 'split') searchParams.set('breakdown', source.breakdown)
	searchParams.set('key', metric === 'volume' ? 'volume24h' : 'openInterest')
	if (includeCex) searchParams.set('includeCex', 'true')
	const route = source.kind === 'split' ? 'overview-breakdown' : 'contract-breakdown'
	return `${RWA_PERPS_CHART_API}/${route}?${searchParams.toString()}`
}

/**
 * The Perps view time series by the Group by: a server split per venue, asset group or reference asset, or the
 * per-contract split (about 8 MB, so only when None is picked). The CEX toggle is the one flag the split honours.
 */
export function useRwaPerpsChartDataset({ source, metric, includeCex, enabled }: RwaPerpsChartDatasetRequest): {
	chartDataset: RWAPositionalChartDataset
	isChartLoading: boolean
	chartError: string | null
} {
	const url = getRwaPerpsChartUrl({ source, metric, includeCex })
	const { data, isLoading, error } = useQuery({
		queryKey: ['rwa-perps-chart', url],
		queryFn: () => fetchJson<RWAChartDataset>(url),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})
	const chartDataset = useMemo(
		() => (enabled && data ? toRwaMultiSeriesChartDataset(data) : EMPTY_DATASET),
		[data, enabled]
	)
	return {
		chartDataset,
		isChartLoading: enabled && isLoading,
		chartError: enabled && error ? (error instanceof Error ? error.message : 'Failed to load perps chart data.') : null
	}
}

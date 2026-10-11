import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchJson } from '~/utils/async'
import { queryReadFailed, type QueryRetry } from '~/utils/query'
import type { IRWAAssetsOverview } from './api.types'
import { getRwaPerpsChartServerKey, type RWAPerpsChartMetric, type RWAPerpsChartSource } from './chartBreakdown'
import { toRwaMultiSeriesChartDataset, type RWAChartDataset, type RWAPositionalChartDataset } from './chartDataset'
import { setRWAPerpsChartScope } from './Perps/api'
import type { RWAPerpsMarketBreakdownTarget } from './Perps/types'

const RWA_PERPS_CHART_API = '/api/public/rwa/perps'
const EMPTY_DATASET: RWAPositionalChartDataset = { source: [], dimensions: ['timestamp'] }
const STALE_TIME = 60 * 60 * 1000

/** The markets a Perps tree page covers, by name as the server reads them: all, one asset group, one underlying or one venue. */
export type RwaPerpsChartScope = Extract<
	RWAPerpsMarketBreakdownTarget,
	{ kind: 'all' | 'assetGroup' | 'baseAsset' | 'venue' }
>

export type RwaPerpsChartDatasetRequest = {
	source: RWAPerpsChartSource
	metric: RWAPerpsChartMetric
	includeCex: boolean
	scope: RwaPerpsChartScope
	enabled: boolean
}

/** An asset group page is the frame with an asset group slug; an underlying page names its asset, as the frame cannot. */
export function getRwaPerpsChartScope(
	overview: Pick<IRWAAssetsOverview, 'assetGroupSlug' | 'selectedAssetGroup'>,
	asset?: string | null
): RwaPerpsChartScope {
	if (asset) return { kind: 'baseAsset', slug: asset }
	if (overview.assetGroupSlug) return { kind: 'assetGroup', slug: overview.selectedAssetGroup }
	return { kind: 'all' }
}

/**
 * The public route and query for a perps chart source and metric. The two split
 * routes reject a base asset, so an underlying's page reads its per-market split whatever the Group by.
 */
export function getRwaPerpsChartUrl({
	source,
	metric,
	includeCex,
	scope
}: Omit<RwaPerpsChartDatasetRequest, 'enabled'>): string {
	const searchParams = new URLSearchParams()
	const route =
		scope.kind === 'baseAsset'
			? 'market-breakdown'
			: source.kind === 'split'
				? 'overview-breakdown'
				: 'contract-breakdown'
	if (route === 'overview-breakdown' && source.kind === 'split') searchParams.set('breakdown', source.breakdown)
	searchParams.set('key', getRwaPerpsChartServerKey(metric))
	setRWAPerpsChartScope(searchParams, { target: scope, includeCex })
	return `${RWA_PERPS_CHART_API}/${route}?${searchParams.toString()}`
}

/** One perps chart route through react-query; the chart panels, the venue totals and the history fold share its cache. */
export function useRwaPerpsChartQuery(url: string, enabled: boolean) {
	return useQuery({
		queryKey: ['rwa-perps-chart', url],
		queryFn: () => fetchJson<RWAChartDataset>(url),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})
}

/**
 * The Perps time series by the Group by: a server split per venue, asset group or reference asset, or the
 * per-contract split (about 8 MB, so only when None is picked). Venue Type DEX only is the one flag the split honors.
 */
export function useRwaPerpsChartDataset({ source, metric, includeCex, scope, enabled }: RwaPerpsChartDatasetRequest): {
	chartDataset: RWAPositionalChartDataset
	isChartLoading: boolean
	/** The query when it has nothing to show and its read failed, for the chart's Try again. */
	failedRead: QueryRetry | null
} {
	const url = getRwaPerpsChartUrl({ source, metric, includeCex, scope })
	const query = useRwaPerpsChartQuery(url, enabled)
	const data = query.data
	const chartDataset = useMemo(
		() => (enabled && data ? toRwaMultiSeriesChartDataset(data) : EMPTY_DATASET),
		[data, enabled]
	)
	return {
		chartDataset,
		isChartLoading: enabled && query.isLoading,
		failedRead: enabled && queryReadFailed(query) ? query : null
	}
}

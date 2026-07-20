import { useQuery } from '@tanstack/react-query'
import type {
	CexAnalyticsMarketSharePoint,
	CexAnalyticsMetric,
	CexAnalyticsSnapshotResponse,
	CexAnalyticsTotalsPoint
} from '~/containers/Cexs/api.types'
import {
	getProCexShareQueryKey,
	PRO_CEX_SNAPSHOT_QUERY_KEY,
	PRO_CEX_TOTALS_QUERY_KEY
} from '~/containers/ProDashboard/tableQueryKeys'
import { fetchJson } from '~/utils/async'

const FIVE_MINUTES = 5 * 60 * 1000

export function useCexAnalyticsSnapshot(enabled = true) {
	return useQuery<CexAnalyticsSnapshotResponse>({
		queryKey: PRO_CEX_SNAPSHOT_QUERY_KEY,
		queryFn: () => fetchJson('/api/dynamic/cexs/analytics?view=snapshot'),
		enabled,
		staleTime: FIVE_MINUTES,
		retry: 1
	})
}

export function useCexAnalyticsTotals(enabled = true) {
	return useQuery<CexAnalyticsTotalsPoint[]>({
		queryKey: PRO_CEX_TOTALS_QUERY_KEY,
		queryFn: () => fetchJson('/api/dynamic/cexs/analytics?view=totals'),
		enabled,
		staleTime: FIVE_MINUTES,
		retry: 1
	})
}

export function useCexAnalyticsMarketShare(metric: CexAnalyticsMetric, topN: number, enabled = true) {
	return useQuery<CexAnalyticsMarketSharePoint[]>({
		queryKey: getProCexShareQueryKey(metric, topN),
		queryFn: () => fetchJson(`/api/dynamic/cexs/analytics?view=share&metric=${metric}&topN=${topN}`),
		enabled,
		staleTime: FIVE_MINUTES,
		retry: 1
	})
}

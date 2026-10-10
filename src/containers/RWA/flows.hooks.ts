import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { queryReadFailed, type QueryRetry } from '~/utils/query'
import type {
	IRWAFlowAssetBreakdownRow,
	IRWAFlowPointWithMcap,
	IRWAFlowOverviewSplitPoint,
	IRWAFlowSummaryResponse,
	IRWAFlowsResponse,
	RWAFlowOverviewSplitBy
} from './api.types'
import { RWA_FLOW_TOTAL_SPLIT_BY } from './flowSplit'

const RWA_FLOWS_STALE_TIME = 30 * 60 * 1000
const RWA_FLOWS_API = '/api/public/rwa/flows'

export type RWAFlowScope =
	| { kind: 'overview' }
	| { kind: 'assetGroup'; slug: string }
	| { kind: 'category'; slug: string }
	| { kind: 'platform'; slug: string }
	| { kind: 'chain'; slug: string }

/** A scope with a slug: the only ones with an asset breakdown small enough to read in the browser. */
export type RWAFlowScopedTarget = Exclude<RWAFlowScope, { kind: 'overview' }>

/** The per-asset flow summary, about 2.8 MB: only a page that reads spot flows asks for it. */
export function useRWAFlowSummary(enabled = true) {
	return useQuery<IRWAFlowSummaryResponse>({
		queryKey: ['rwa-flows', 'summary'],
		queryFn: () => fetchJson<IRWAFlowSummaryResponse>(`${RWA_FLOWS_API}/summary`),
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})
}

export function useRWAAssetFlows(assetId: string, enabled: boolean) {
	return useQuery<IRWAFlowsResponse<IRWAFlowPointWithMcap>>({
		queryKey: ['rwa-flows', 'asset', assetId],
		queryFn: () =>
			fetchJson<IRWAFlowsResponse<IRWAFlowPointWithMcap>>(
				`${RWA_FLOWS_API}/asset/${encodeURIComponent(assetId)}?withMcap=true`
			),
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: enabled && assetId.length > 0
	})
}

function useRWAFlowOverviewSplitWithFilters(
	splitBy: RWAFlowOverviewSplitBy,
	includeStablecoin: boolean,
	includeGovernance: boolean,
	enabled: boolean
) {
	const searchParams = new URLSearchParams({ splitBy })
	searchParams.set('includeStablecoin', String(includeStablecoin))
	searchParams.set('includeGovernance', String(includeGovernance))
	return useQuery<Array<IRWAFlowOverviewSplitPoint>>({
		queryKey: ['rwa-flows', 'overview-split', splitBy, includeStablecoin, includeGovernance],
		queryFn: () => fetchJson<Array<IRWAFlowOverviewSplitPoint>>(`${RWA_FLOWS_API}/overview?${searchParams.toString()}`),
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})
}

function useRWAFlowAssetBreakdown(target: RWAFlowScopedTarget | null, enabled: boolean) {
	return useQuery<Array<IRWAFlowAssetBreakdownRow>>({
		queryKey: ['rwa-flows', 'asset-breakdown', target?.kind ?? 'none', target?.slug ?? ''],
		queryFn: () => {
			if (!target) throw new Error('The overview reads the flows split, not the asset breakdown')
			return fetchJson<Array<IRWAFlowAssetBreakdownRow>>(
				`${RWA_FLOWS_API}/asset-breakdown/${target.kind}/${encodeURIComponent(target.slug)}`
			)
		},
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: enabled && target != null
	})
}

export type RWAFlowSeriesRequest = {
	scope: RWAFlowScope
	/** The split the front page reads; the total sums the asset group split when no grouping is asked for. */
	splitBy?: RWAFlowOverviewSplitBy
	includeStablecoin: boolean
	includeGovernance: boolean
	enabled: boolean
}

export type RWAFlowSeriesResult = {
	/** The front page: one row per day with a value per asset group, summed by `sumRwaFlowSplit`. */
	splitPoints: Array<IRWAFlowOverviewSplitPoint> | undefined
	/** A scoped page: one row per day with a value per asset, folded by `aggregateRWAFlowRows`. */
	assetRows: Array<IRWAFlowAssetBreakdownRow> | undefined
	isLoading: boolean
	/** The query when it has nothing to show and its read failed, for the chart's Try again. */
	failedRead: QueryRetry | null
}

/**
 * The rows the flows chart reads. The front page reads the asset group split (about 0.5 MB) and never the
 * unscoped asset breakdown (about 58 MB); scoped pages keep their scoped breakdown so the table filters apply.
 */
export function useRWAFlowSeries({
	scope,
	splitBy = RWA_FLOW_TOTAL_SPLIT_BY,
	includeStablecoin,
	includeGovernance,
	enabled
}: RWAFlowSeriesRequest): RWAFlowSeriesResult {
	const isOverview = scope.kind === 'overview'
	const split = useRWAFlowOverviewSplitWithFilters(splitBy, includeStablecoin, includeGovernance, enabled && isOverview)
	const breakdown = useRWAFlowAssetBreakdown(isOverview ? null : scope, enabled && !isOverview)
	if (isOverview) {
		return {
			splitPoints: split.data,
			assetRows: undefined,
			isLoading: split.isLoading,
			failedRead: enabled && queryReadFailed(split) ? split : null
		}
	}
	return {
		splitPoints: undefined,
		assetRows: breakdown.data,
		isLoading: breakdown.isLoading,
		failedRead: enabled && queryReadFailed(breakdown) ? breakdown : null
	}
}

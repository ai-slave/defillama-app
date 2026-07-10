import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import type {
	IRWAFlowAssetBreakdownRow,
	IRWAFlowOverviewSplitPoint,
	IRWAFlowSummaryResponse,
	IRWAFlowsResponse,
	RWAFlowOverviewSplitBy
} from './api.types'

const RWA_FLOWS_STALE_TIME = 30 * 60 * 1000
const RWA_FLOWS_API = '/api/public/rwa/flows'

export type RWAFlowScope =
	| { kind: 'overview' }
	| { kind: 'assetGroup'; slug: string }
	| { kind: 'category'; slug: string }
	| { kind: 'platform'; slug: string }
	| { kind: 'chain'; slug: string }

export function useRWAFlowSummary() {
	return useQuery<IRWAFlowSummaryResponse>({
		queryKey: ['rwa-flows', 'summary'],
		queryFn: () => fetchJson<IRWAFlowSummaryResponse>(`${RWA_FLOWS_API}/summary`),
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})
}

export function useRWAAssetFlows(assetId: string, enabled: boolean) {
	return useQuery<IRWAFlowsResponse>({
		queryKey: ['rwa-flows', 'asset', assetId],
		queryFn: () => fetchJson<IRWAFlowsResponse>(`${RWA_FLOWS_API}/asset/${encodeURIComponent(assetId)}?withMcap=true`),
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: enabled && assetId.length > 0
	})
}

export function useRWAFlowOverviewSplitWithFilters(
	splitBy: RWAFlowOverviewSplitBy,
	includeStablecoin: boolean,
	includeGovernance: boolean,
	enabled: boolean
) {
	const searchParams = new URLSearchParams({ splitBy })
	searchParams.set('includeStablecoin', String(includeStablecoin))
	searchParams.set('includeGovernance', String(includeGovernance))
	return useQuery<IRWAFlowOverviewSplitPoint[]>({
		queryKey: ['rwa-flows', 'overview-split', splitBy, includeStablecoin, includeGovernance],
		queryFn: () => fetchJson<IRWAFlowOverviewSplitPoint[]>(`${RWA_FLOWS_API}/overview?${searchParams.toString()}`),
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})
}

export function useRWAFlowAssetBreakdown(target: RWAFlowScope, enabled: boolean) {
	return useQuery<IRWAFlowAssetBreakdownRow[]>({
		queryKey: ['rwa-flows', 'asset-breakdown', target.kind, target.kind === 'overview' ? 'all' : target.slug],
		queryFn: () => {
			if (target.kind === 'overview') return fetchJson<IRWAFlowAssetBreakdownRow[]>(`${RWA_FLOWS_API}/asset-breakdown`)
			return fetchJson<IRWAFlowAssetBreakdownRow[]>(
				`${RWA_FLOWS_API}/asset-breakdown/${target.kind}/${encodeURIComponent(target.slug)}`
			)
		},
		staleTime: RWA_FLOWS_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled
	})
}

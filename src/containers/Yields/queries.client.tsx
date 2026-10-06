import { useQuery } from '@tanstack/react-query'
import { fetchJson, handleSimpleFetchResponse } from '~/utils/async'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from './poolDetail/fetch'
import type { BorrowMarketHistory, PoolHistory } from './poolDetail/types'
import { useVerifiedAccess } from './useVerifiedAccess'
import type { YieldsPaginatedTableResponse } from './yieldsTableQuery'

export type YieldsTableSeed<TRow> = {
	initialData: YieldsPaginatedTableResponse<TRow>
	initialDataUpdatedAt: number
	/** The tier the rows were built for. Defaults to the public, redacted variant. */
	verifiedAccess?: boolean
}

export const useYieldsPaginatedTable = <TRow,>(
	endpoint: string,
	queryString: string | null,
	seed?: YieldsTableSeed<TRow>,
	/** Subscriber mirror of `endpoint`. Omitted on surfaces with no gated columns. */
	privateEndpoint?: string
) => {
	// A subscriber reads the private mirror; everyone else reads the public, redacted document a CDN
	// can keep. Same shape either way, so nothing downstream knows which tier it rendered.
	const { authorizedFetch, hasAccess, isPending } = useVerifiedAccess()
	const entitlementPending = privateEndpoint != null && isPending
	const paid = privateEndpoint != null && hasAccess
	// Do not speculate with the public endpoint while the user's tier is unknown. Besides flashing
	// locked rows, that request is guaranteed waste for a subscriber once auth resolves.
	const url = queryString && !entitlementPending ? `${paid ? privateEndpoint : endpoint}${queryString}` : null
	return useQuery<YieldsPaginatedTableResponse<TRow>>({
		queryKey: ['yield-paginated-table', endpoint, queryString, entitlementPending ? 'pending' : paid],
		// Server-rendered first page for the default view: rows render with zero fetches while fresh.
		// Keep the server-selected tier while entitlement is unresolved; once known, only a matching
		// seed can initialize the tier-specific cache.
		...(seed && (entitlementPending || (seed.verifiedAccess ?? false) === paid)
			? { initialData: seed.initialData, initialDataUpdatedAt: seed.initialDataUpdatedAt }
			: {}),
		queryFn: async ({ signal }) => {
			if (!url) return { rows: [], total: 0, page: 1, pageSize: 50, hasMore: false }
			if (!paid) return fetchJson<YieldsPaginatedTableResponse<TRow>>(url, { signal })
			const res = await authorizedFetch(url)
			if (!res) throw new Error('Authentication required')
			return handleSimpleFetchResponse(res).then((r) => r.json() as Promise<YieldsPaginatedTableResponse<TRow>>)
		},
		// Keep rows across pages and filters, never across a tier change.
		meta: { paid, entitlementPending },
		placeholderData: (previousData, previousQuery) =>
			previousQuery?.meta?.paid === paid && previousQuery.meta.entitlementPending === entitlementPending
				? previousData
				: undefined,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!url
	})
}
// The pro dashboard reads and stream-seeds the same pool history entries.
export const getYieldSupplyHistoryQueryKey = (configID: string | null) => ['yield-supply-history', configID] as const
export const getYieldBorrowHistoryQueryKey = (configID: string | null) => ['yield-borrow-history', configID] as const

// single pool chart data
export const useYieldChartData = (configID: string | null) => {
	return useQuery<PoolHistory>({
		queryKey: getYieldSupplyHistoryQueryKey(configID),
		queryFn: () => fetchPoolDetailHistory(configID!, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!configID
	})
}
export const useYieldChartLendBorrow = (configID: string | null, enabled = true) => {
	return useQuery<BorrowMarketHistory>({
		queryKey: getYieldBorrowHistoryQueryKey(configID),
		queryFn: () => fetchBorrowMarketDetailHistory(configID!, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!configID && enabled
	})
}

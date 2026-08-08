import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from './poolDetail/fetch'
import type { BorrowMarketHistory, PoolHistory } from './poolDetail/types'
import type { YieldsPaginatedTableResponse } from './yieldsTableQuery'

export type YieldsTableSeed<TRow> = {
	initialData: YieldsPaginatedTableResponse<TRow>
	initialDataUpdatedAt: number
}

export const useYieldsPaginatedTable = <TRow,>(
	endpoint: string,
	queryString: string | null,
	seed?: YieldsTableSeed<TRow>
) => {
	const url = queryString ? `${endpoint}${queryString}` : null
	return useQuery<YieldsPaginatedTableResponse<TRow>>({
		queryKey: ['yield-paginated-table', endpoint, queryString],
		// ISR-provided first page for the default view: rows render with zero
		// fetches while fresh; staleness (dated from the ISR build) triggers at
		// most one background refresh.
		...(seed ? { initialData: seed.initialData, initialDataUpdatedAt: seed.initialDataUpdatedAt } : {}),
		queryFn: async ({ signal }) =>
			url
				? fetchJson<YieldsPaginatedTableResponse<TRow>>(url, { signal })
				: {
						rows: [],
						total: 0,
						page: 1,
						pageSize: 50,
						hasMore: false
					},
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!url
	})
}
// single pool chart data
export const useYieldChartData = (configID: string | null) => {
	return useQuery<PoolHistory>({
		queryKey: ['yield-supply-history', configID],
		queryFn: () => fetchPoolDetailHistory(configID!, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!configID
	})
}
export const useYieldChartLendBorrow = (configID: string | null, enabled = true) => {
	return useQuery<BorrowMarketHistory>({
		queryKey: ['yield-borrow-history', configID],
		queryFn: () => fetchBorrowMarketDetailHistory(configID!, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!configID && enabled
	})
}

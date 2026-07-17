import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '~/containers/Subscription/auth'
import { fetchJson, handleSimpleFetchResponse } from '~/utils/async'
import { YIELD_EARN_DATASET_API, YIELD_EARN_PREMIUM_DATASET_API } from './constants'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from './poolDetail/fetch'
import type { BorrowMarketHistory, PoolHistory } from './poolDetail/types'
import type { YieldsPaginatedTableResponse } from './yieldsTableQuery'

export const useYieldsPaginatedTable = <TRow,>(endpoint: string, queryString: string | null) => {
	const { hasActiveSubscription, authorizedFetch } = useAuthContext()
	const resolvedEndpoint =
		endpoint === YIELD_EARN_DATASET_API && hasActiveSubscription ? YIELD_EARN_PREMIUM_DATASET_API : endpoint
	const url = queryString ? `${resolvedEndpoint}${queryString}` : null
	return useQuery<YieldsPaginatedTableResponse<TRow>>({
		queryKey: ['yield-paginated-table', resolvedEndpoint, queryString],
		queryFn: async ({ signal }) =>
			url
				? resolvedEndpoint === YIELD_EARN_PREMIUM_DATASET_API
					? authorizedFetch(url, { signal })
							.then((response) => {
								if (!response) throw new Error('Authentication required')
								return handleSimpleFetchResponse(response)
							})
							.then((response) => response.json() as Promise<YieldsPaginatedTableResponse<TRow>>)
					: fetchJson<YieldsPaginatedTableResponse<TRow>>(url, { signal })
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

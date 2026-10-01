import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { handleSimpleFetchResponse } from '~/utils/async'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { fetchPoolDetailHistory } from './fetch'
import type { PoolHistory, PoolHistoryRange } from './types'

// Range refetches for the pool charts. Subscribers use the private route (the proxy is redacted for
// everyone); the query cache collapses the three panels' identical requests into one. `updatedAtMs` is
// when that history was read, which may predate the call by up to the stale time.
export function useVerifiedHistoryFetcher(poolId: string): {
	fetchHistory: (range: PoolHistoryRange) => Promise<{ history: PoolHistory; updatedAtMs: number }>
	isPending: boolean
} {
	const { authorizedFetch, hasAccess: paid, isPending, status } = useVerifiedAccess()
	const queryClient = useQueryClient()

	const fetchHistory = useCallback(
		async (range: PoolHistoryRange) => {
			// Tier in the key: a lapsed subscription must not read the paid entry.
			const queryKey = ['yields-pool-history', poolId, range, status]
			const history = await queryClient.fetchQuery({
				queryKey,
				staleTime: 5 * 60 * 1000,
				queryFn: async () => {
					if (isPending) throw new Error('Subscription status is still loading')
					if (!paid) return fetchPoolDetailHistory(poolId, range)
					const res = await authorizedFetch(
						`/api/private/yields/pool/${encodeURIComponent(poolId)}/history?range=${encodeURIComponent(range)}`
					)
					// Failed authorization falls back to the redacted history so the reported series still draws.
					if (!res) return fetchPoolDetailHistory(poolId, range)
					const body = (await handleSimpleFetchResponse(res).then((r) => r.json())) as { data: PoolHistory }
					return body.data
				}
			})
			return { history, updatedAtMs: queryClient.getQueryState(queryKey)!.dataUpdatedAt }
		},
		[authorizedFetch, isPending, paid, poolId, queryClient, status]
	)

	return { fetchHistory, isPending }
}

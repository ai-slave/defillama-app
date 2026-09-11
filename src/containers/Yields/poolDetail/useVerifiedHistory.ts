import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { handleSimpleFetchResponse } from '~/utils/async'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { fetchPoolDetailHistory } from './fetch'
import type { PoolHistory, PoolHistoryRange } from './types'

// Range refetches for the pool charts. Subscribers use the private route (the proxy is redacted for
// everyone); the query cache collapses the three panels' identical requests into one.
export function useVerifiedHistoryFetcher(poolId: string): {
	fetchHistory: (range: PoolHistoryRange) => Promise<PoolHistory>
	isPending: boolean
} {
	const { authorizedFetch, hasAccess: paid, isPending, status } = useVerifiedAccess()
	const queryClient = useQueryClient()

	const fetchHistory = useCallback(
		(range: PoolHistoryRange) =>
			queryClient.fetchQuery({
				// Tier in the key: a lapsed subscription must not read the paid entry.
				queryKey: ['yields-pool-history', poolId, range, status],
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
			}),
		[authorizedFetch, isPending, paid, poolId, queryClient, status]
	)

	return { fetchHistory, isPending }
}

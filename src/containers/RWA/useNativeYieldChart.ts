import { useQuery } from '@tanstack/react-query'
import { fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import type { PoolHistory } from '~/containers/Yields/poolDetail/types'

// Native-yield history for the RWA asset page's chart. Reuses the pool detail page's
// history client fetch (`/v2/earn/:id/history`), pulling the full ('max') range so the
// chart shows the whole APY history.
export function useNativeYieldHistory(poolId: string | null) {
	return useQuery<PoolHistory>({
		queryKey: ['rwa-native-yield-history', poolId],
		queryFn: () => fetchPoolDetailHistory(poolId as string, 'max'),
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!poolId
	})
}

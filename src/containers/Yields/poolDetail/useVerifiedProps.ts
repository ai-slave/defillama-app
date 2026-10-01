import { useQuery } from '@tanstack/react-query'
import { handleSimpleFetchResponse } from '~/utils/async'
import { useVerifiedAccess } from '../useVerifiedAccess'
import type { PoolHistoryRange } from './types'
import { EMPTY_POOL_VERIFIED_PROPS, type PoolVerifiedProps } from './verifiedProps'

/**
 * The measured props for a reader who paid for them. The page's own props are always redacted so
 * its HTML can be publicly cached; `verifiedLocked` marks a pool whose measurement was withheld.
 */
export function usePoolVerifiedProps({
	poolId,
	range,
	locked
}: {
	poolId: string
	range: PoolHistoryRange
	locked: boolean
}): { props: PoolVerifiedProps; isLoading: boolean; updatedAtMs: number } {
	const { authorizedFetch, hasAccess: paid } = useVerifiedAccess()
	const enabled = locked && paid

	const { data, isLoading, dataUpdatedAt } = useQuery<PoolVerifiedProps>({
		// Tier in the key: a lapsed subscription must not read the paid entry.
		queryKey: ['yields-verified-pool', poolId, range, paid],
		queryFn: async () => {
			const res = await authorizedFetch(
				`/api/private/yields/pool/${encodeURIComponent(poolId)}?range=${encodeURIComponent(range)}`
			)
			if (!res) throw new Error('Authentication required')
			return handleSimpleFetchResponse(res).then((r) => r.json() as Promise<PoolVerifiedProps>)
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		throwOnError: false,
		enabled
	})

	// `enabled: false` still hands back cached data, so entitlement is re-checked on every render.
	// Never seeded, so `dataUpdatedAt` is this fetch's own time and only ever describes client-rendered data.
	return {
		props: enabled && data ? data : EMPTY_POOL_VERIFIED_PROPS,
		isLoading: enabled && isLoading,
		updatedAtMs: dataUpdatedAt
	}
}

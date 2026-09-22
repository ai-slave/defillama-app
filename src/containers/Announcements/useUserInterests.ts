import { useQuery } from '@tanstack/react-query'
import { fetchUserInterests } from '~/api/users'
import type { UserInterestsResponse } from '~/api/users.types'
import { useAuthContext } from '~/auth'
import { readPersistedUserInterests, writePersistedUserInterests } from './userInterestsStorage'

export type UserInterestsState =
	| { status: 'anonymous' }
	/** A token whose record has not arrived, or a request in flight. */
	| { status: 'loading' }
	| { status: 'ready'; profile: UserInterestsResponse }
	| { status: 'failed' }

export function useUserInterests(): UserInterestsState {
	const { authToken, user } = useAuthContext()
	const userId = user?.id ?? null

	const query = useQuery({
		queryKey: ['user-interests', userId],
		queryFn: async () => {
			const now = Date.now()
			const cached = readPersistedUserInterests({ userId: userId!, now })
			if (cached) return cached
			const fresh = await fetchUserInterests(authToken!)
			writePersistedUserInterests({ userId: userId!, value: fresh, now })
			return fresh
		},
		enabled: authToken != null && userId != null,
		staleTime: Infinity,
		retry: false
	})

	if (authToken == null) return { status: 'anonymous' }
	if (query.isSuccess) return { status: 'ready', profile: query.data }
	if (query.isError) return { status: 'failed' }
	return { status: 'loading' }
}

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { queryReadFailed } from '~/utils/query'
import { type FollowingShelf, dashboardAPI } from '../services/DashboardAPI'

const EMPTY_SHELVES: Array<FollowingShelf> = []

export function useFollowingAuthors() {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	const [page, setPage] = useState(1)
	const limit = 10

	const followingQuery = useQuery({
		queryKey: ['pro-dashboard', 'following-authors', user?.id, page, limit],
		queryFn: () => dashboardAPI.getFollowingAuthors({ page, limit }, authorizedFetch),
		// The pager stays mounted, with focus on it, while the next page loads; never another account's shelves.
		placeholderData: (previousData, previousQuery) => {
			if (previousQuery && previousQuery.queryKey[2] === user?.id) return previousData
		},
		staleTime: 1000 * 60 * 5,
		enabled: isAuthenticated
	})

	const { data, isLoading, isFetching, refetch } = followingQuery

	return {
		shelves: data?.items ?? EMPTY_SHELVES,
		isLoading,
		isFetching,
		readFailed: queryReadFailed(followingQuery),
		page,
		totalPages: data?.totalPages || 1,
		refetch,
		goToPage: setPage
	}
}

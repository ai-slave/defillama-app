import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { queryReadFailed } from '~/utils/query'
import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI } from '../services/DashboardAPI'

const EMPTY_DASHBOARDS: Array<Dashboard> = []
const LIMIT = 20

export function useLikedDashboards() {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	const [page, setPage] = useState(1)

	const likedQuery = useQuery({
		queryKey: ['pro-dashboard', 'liked-dashboards', user?.id, page, LIMIT],
		queryFn: async () => {
			if (!isAuthenticated) {
				return {
					items: EMPTY_DASHBOARDS,
					page: 1,
					perPage: LIMIT,
					totalItems: 0,
					totalPages: 0
				}
			}
			return await dashboardAPI.getLikedDashboards({ page, limit: LIMIT }, authorizedFetch)
		},
		// The pager stays mounted, with focus on it, while the next page loads; never another account's list.
		placeholderData: (previousData, previousQuery) => {
			if (previousQuery && previousQuery.queryKey[2] === user?.id) return previousData
		},
		staleTime: 1000 * 60 * 5,
		enabled: isAuthenticated
	})

	const { data, isLoading, isFetching, refetch } = likedQuery

	return {
		dashboards: data?.items ?? EMPTY_DASHBOARDS,
		isLoading,
		isFetching,
		readFailed: queryReadFailed(likedQuery),
		page,
		totalPages: data?.totalPages || 1,
		refetch,
		goToPage: setPage
	}
}

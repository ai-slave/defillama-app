import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import { useAuthContext } from '~/auth'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI } from '../services/DashboardAPI'

const EMPTY_DASHBOARDS: Array<Dashboard> = []

interface UseTeamDashboardsParams {
	page: number
	limit: number
	enabled?: boolean
}

/** Dashboards shared with the viewer's team (`GET /dashboards?scope=team`). Empty without a team. */
export function useTeamDashboards({ page, limit, enabled = true }: UseTeamDashboardsParams) {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	const router = useRouter()

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ['pro-dashboard', 'team-dashboards', user?.id, page, limit],
		queryFn: async () => {
			if (!isAuthenticated) {
				return { items: EMPTY_DASHBOARDS, page: 1, perPage: limit, totalItems: 0, totalPages: 0 }
			}
			return await dashboardAPI.listDashboardsPaginated({ page, limit, scope: 'team' }, authorizedFetch)
		},
		staleTime: 1000 * 60 * 5,
		enabled: isAuthenticated && enabled
	})

	const goToPage = useCallback(
		(newPage: number) => {
			void pushShallowQuery(router, { tab: 'team', page: newPage }, '/pro')
		},
		[router]
	)

	return {
		dashboards: data?.items ?? EMPTY_DASHBOARDS,
		isLoading,
		error,
		page: data?.page || page,
		totalPages: data?.totalPages || 1,
		totalItems: data?.totalItems || 0,
		refetch,
		goToPage
	}
}

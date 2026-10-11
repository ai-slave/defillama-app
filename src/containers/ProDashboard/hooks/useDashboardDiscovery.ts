import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { httpErrorMessage, ReaderError } from '~/utils/async'
import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI } from '../services/DashboardAPI'

const EMPTY_DASHBOARDS: Array<Dashboard> = []

interface SearchParams {
	query?: string
	tags?: Array<string>
	visibility?: 'public' | 'private'
	sortBy?: 'popular' | 'recent' | 'likes' | 'trending'
	timeFrame?: '1d' | '7d' | '30d'
	page?: number
	limit?: number
}

export function useDashboardDiscovery(params: SearchParams) {
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated } = useAuthContext()

	const isSearchMode = !!(params.query || params.tags?.length)

	const discoverQuery = useQuery({
		queryKey: ['pro-dashboard', 'dashboard-discover', params.page, params.limit, params.sortBy, params.timeFrame],
		queryFn: async () => {
			if (isSearchMode) return null

			if (params.sortBy) {
				return await dashboardAPI.searchDashboards(
					{
						visibility: 'public',
						sortBy: params.sortBy,
						timeFrame: params.timeFrame,
						page: params.page || 1,
						limit: params.limit || 20
					},
					isAuthenticated ? authorizedFetch : undefined
				)
			}
			return await dashboardAPI.discoverDashboards(
				{
					page: params.page || 1,
					limit: params.limit || 20
				},
				isAuthenticated ? authorizedFetch : undefined
			)
		},
		// The pager stays mounted, with focus on it, while the next page loads.
		placeholderData: keepPreviousData,
		staleTime: 1000 * 60 * 5,
		enabled: !isSearchMode
	})

	const searchQuery = useQuery({
		queryKey: ['pro-dashboard', 'dashboard-search', params],
		queryFn: async () => {
			if (!isSearchMode) return null
			return await dashboardAPI.searchDashboards(params, isAuthenticated ? authorizedFetch : undefined)
		},
		placeholderData: keepPreviousData,
		staleTime: 1000 * 60 * 2,
		enabled: isSearchMode
	})

	const likeMutation = useMutation({
		mutationFn: async (dashboardId: string) => {
			if (!isAuthenticated) {
				throw new ReaderError('Sign in to star dashboards.')
			}
			return await dashboardAPI.likeDashboard(dashboardId, authorizedFetch)
		},
		onSuccess: (data, dashboardId) => {
			const updateLikeCount = (oldData: any) => {
				if (!oldData) return oldData
				return {
					...oldData,
					items: oldData.items.map((d: Dashboard) =>
						d.id === dashboardId ? { ...d, likeCount: data.likeCount, liked: data.liked } : d
					)
				}
			}
			queryClient.setQueriesData({ queryKey: ['pro-dashboard', 'dashboard-discover'] }, updateLikeCount)
			queryClient.setQueriesData({ queryKey: ['pro-dashboard', 'dashboard-search'] }, updateLikeCount)
			toast.success(data.liked ? 'Dashboard starred' : 'Star removed')
		},
		onError: (error: unknown) => {
			toast.error(httpErrorMessage(error, "Couldn't update the star."))
		}
	})

	const activeQuery = isSearchMode ? searchQuery : discoverQuery
	const data = activeQuery.data

	return {
		dashboards: data?.items ?? EMPTY_DASHBOARDS,
		isLoading: activeQuery.isLoading,
		error: activeQuery.error as Error | null,
		totalPages: data?.totalPages || 1,
		totalItems: data?.totalItems || 0,
		currentPage: data?.page || 1,
		likeDashboard: likeMutation.mutate,
		isLiking: likeMutation.isPending
	}
}

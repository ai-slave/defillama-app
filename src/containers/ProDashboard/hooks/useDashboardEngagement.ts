import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { httpErrorMessage } from '~/utils/async'
import type { Dashboard } from '../dashboardTypes'
import { dashboardAPI } from '../services/DashboardAPI'

export function useDashboardEngagement(dashboardId: string | null) {
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated } = useAuthContext()

	const viewMutation = useMutation({
		mutationFn: async (id: string) => {
			return await dashboardAPI.viewDashboard(id, isAuthenticated ? authorizedFetch : undefined)
		},
		onSuccess: (data, id) => {
			if (!data) return
			queryClient.setQueriesData(
				{ queryKey: ['pro-dashboard', 'dashboard'], exact: false },
				(oldData: Dashboard | undefined) => {
					if (!oldData || oldData.id !== id) return oldData
					return { ...oldData, ...data }
				}
			)
		},
		onError: (error: unknown) => {
			console.log('Failed to track dashboard view:', error)
		}
	})

	const likeMutation = useMutation({
		mutationFn: (id: string) => dashboardAPI.likeDashboard(id, authorizedFetch),
		onSuccess: (data, id) => {
			if (!data) return
			queryClient.setQueriesData(
				{ queryKey: ['pro-dashboard', 'dashboard'], exact: false },
				(oldData: Dashboard | undefined) => {
					if (!oldData || oldData.id !== id) return oldData
					return {
						...oldData,
						likeCount: data.likeCount,
						liked: data.liked
					}
				}
			)
			queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'liked-dashboards'] })
			toast.success(data.liked ? 'Dashboard starred' : 'Star removed')
		},
		onError: (error: unknown) => {
			toast.error(httpErrorMessage(error, "Couldn't update the star."))
		}
	})

	return {
		trackView: () => {
			if (dashboardId) viewMutation.mutate(dashboardId)
		},
		toggleLike: () => {
			if (!dashboardId) return
			if (!isAuthenticated) {
				toast.error('Sign in to star dashboards.')
				return
			}
			likeMutation.mutate(dashboardId)
		},
		isLiking: likeMutation.isPending && likeMutation.variables === dashboardId,
		liked: likeMutation.variables === dashboardId ? likeMutation.data?.liked : undefined,
		likeCount: likeMutation.variables === dashboardId ? likeMutation.data?.likeCount : undefined
	}
}

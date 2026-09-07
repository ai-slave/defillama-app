import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import type { Dashboard } from '../dashboardTypes'
import {
	DashboardError,
	dashboardAPI,
	dashboardUrlKey,
	type DashboardSavePayload,
	type LiteDashboardSummary
} from '../services/DashboardAPI'

const EMPTY_DASHBOARDS: Array<Dashboard> = []

function parseStoredLiteDashboards(value: string): Array<LiteDashboardSummary> {
	let parsed: unknown
	try {
		parsed = JSON.parse(value)
	} catch {
		return []
	}
	if (!Array.isArray(parsed)) return []
	const dashboards: Array<LiteDashboardSummary> = []
	for (const entry of parsed) {
		if (typeof entry !== 'object' || entry === null || !('id' in entry) || !('name' in entry)) continue
		if (typeof entry.id !== 'string' || typeof entry.name !== 'string') continue
		if ('slug' in entry && entry.slug !== undefined && typeof entry.slug !== 'string') continue
		dashboards.push({
			id: entry.id,
			name: entry.name,
			...('slug' in entry && typeof entry.slug === 'string' ? { slug: entry.slug } : {})
		})
	}
	return dashboards
}

export function useGetLiteDashboards() {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()

	const liteDashboardsInStorage = useStorageItem('lite-dashboards', '[]')

	const liteDashboards = parseStoredLiteDashboards(liteDashboardsInStorage)

	const { isLoading, error } = useQuery({
		queryKey: ['pro-dashboard', 'lite-dashboards', user?.id],
		queryFn: async () => {
			if (!isAuthenticated) return []
			try {
				const data = await dashboardAPI.listLiteDashboards(authorizedFetch)
				setStorageItem('lite-dashboards', JSON.stringify(data))
				return data
			} catch (listError) {
				console.log('Failed to load lite dashboards:', listError)
				setStorageItem('lite-dashboards', '[]')

				return []
			}
		},
		staleTime: 24 * 60 * 60 * 1000, // 24 hours
		refetchOnWindowFocus: false,
		enabled: isAuthenticated && !!user?.id
	})

	return {
		data: liteDashboards,
		isLoading: liteDashboards.length === 0 && isLoading,
		error
	}
}

export function useDashboardAPI(dashboardId: string | null) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()

	// Query for fetching dashboards list
	const {
		data: dashboardsData,
		isLoading: isLoadingDashboards,
		error: dashboardsError
	} = useQuery({
		queryKey: ['pro-dashboard', 'dashboards', user?.id],
		queryFn: async () => {
			if (!isAuthenticated) return []
			try {
				return await dashboardAPI.listDashboards(authorizedFetch)
			} catch (error) {
				console.log('Failed to load dashboards:', error)
				return []
			}
		},
		staleTime: 1000 * 60 * 5,
		enabled: isAuthenticated && !!user?.id
	})
	const dashboards = dashboardsData ?? EMPTY_DASHBOARDS

	const createDashboardMutation = useMutation({
		mutationFn: async (data: DashboardSavePayload) => {
			return await dashboardAPI.createDashboard(data, authorizedFetch)
		},
		onSuccess: (dashboard) => {
			queryClient.setQueryData(
				['pro-dashboard', 'dashboard', dashboardUrlKey(dashboard), isAuthenticated, user?.id],
				dashboard
			)
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
		},
		onError: (err: unknown) => {
			toast.error(err instanceof Error ? err.message : 'Failed to create dashboard')
		}
	})

	const updateDashboardMutation = useMutation({
		// Settings and page remounts must not let an older save overtake a newer save.
		scope: { id: `pro-dashboard-update:${dashboardId}` },
		mutationFn: async ({ id, data }: { id: string; data: DashboardSavePayload }) => {
			return await dashboardAPI.updateDashboard(id, data, authorizedFetch)
		},
		onSuccess: (dashboard: Dashboard) => {
			queryClient.setQueriesData(
				{ queryKey: ['pro-dashboard', 'dashboard'], exact: false },
				(oldData: Dashboard | undefined) => (oldData?.id === dashboard.id ? dashboard : oldData)
			)
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
		},
		onError: (err: unknown) => {
			toast.error(err instanceof Error ? err.message : 'Failed to save dashboard')
		}
	})

	// Mutation to delete dashboard
	const deleteDashboardMutation = useMutation({
		mutationFn: async ({ id }: { id: string; slug?: string }) => {
			return await dashboardAPI.deleteDashboard(id, authorizedFetch)
		},
		onSuccess: (_, deleted) => {
			queryClient.removeQueries({ queryKey: ['pro-dashboard', 'dashboard', deleted.id] })
			if (deleted.slug) {
				queryClient.removeQueries({ queryKey: ['pro-dashboard', 'dashboard', deleted.slug] })
			}
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
			// Navigate away if current dashboard was deleted
			const routeKey = router.query.dashboardId
			if (routeKey === deleted.id || (deleted.slug && routeKey === deleted.slug)) {
				void router.push('/pro')
			}
		}
	})

	const loadDashboard = useCallback(
		(id: string) =>
			dashboardAPI.getDashboard(id, isAuthenticated ? authorizedFetch : undefined).catch((error: unknown) => {
				if (error instanceof DashboardError && error.status === 404) return null
				throw error
			}),
		[isAuthenticated, authorizedFetch]
	)

	// Navigate to a dashboard
	const navigateToDashboard = useCallback(
		(id: string) => {
			void router.push(`/pro/${id}`)
		},
		[router]
	)

	// Delete dashboard (confirmation handled in UI)
	const deleteDashboardWithConfirmation = useCallback(
		async (id: string, slug?: string) => {
			await deleteDashboardMutation.mutateAsync({ id, ...(slug === undefined ? {} : { slug }) })
		},
		[deleteDashboardMutation]
	)

	return {
		// Data
		dashboards,
		isLoadingDashboards,
		dashboardsError,

		// Mutations
		createDashboard: createDashboardMutation,
		updateDashboard: updateDashboardMutation,
		deleteDashboard: deleteDashboardWithConfirmation,
		isDeleting: deleteDashboardMutation.isPending,

		// Actions
		loadDashboard,
		navigateToDashboard
	}
}

import {
	type MutationState,
	type QueryClient,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import type { Dashboard } from '../dashboardTypes'
import {
	DashboardError,
	dashboardAPI,
	dashboardUrlKey,
	type DashboardAuthorizedFetch,
	type DashboardSavePayload,
	type LiteDashboardSummary
} from '../services/DashboardAPI'
import {
	dashboardPayloadChanges,
	mergeDashboardItems,
	toDashboardSavePayload,
	toPersistedDashboardItems
} from '../utils/dashboardUtils'

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

export function liteDashboardsQuery(authorizedFetch: DashboardAuthorizedFetch, userId: string | undefined) {
	return queryOptions({
		queryKey: ['pro-dashboard', 'lite-dashboards', userId],
		queryFn: async () => {
			const data = await dashboardAPI.listLiteDashboards(authorizedFetch)
			// Storage keeps the last list the server returned; a failed read leaves it, so it is never an empty account.
			setStorageItem('lite-dashboards', JSON.stringify(data))
			return data
		},
		staleTime: 24 * 60 * 60 * 1000, // 24 hours
		refetchOnWindowFocus: false
	})
}

export function useGetLiteDashboards() {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()

	const liteDashboardsInStorage = useStorageItem('lite-dashboards', '[]')

	const liteDashboards = parseStoredLiteDashboards(liteDashboardsInStorage)

	const liteQuery = useQuery({
		...liteDashboardsQuery(authorizedFetch, user?.id),
		enabled: isAuthenticated && !!user?.id
	})
	const { isLoading, isFetching, refetch } = liteQuery
	// Storage, not the query, holds the list on screen, so any failed attempt counts, a refetch after a success too.
	const failed = queryReadFailed(liteQuery) || queryRefreshFailed(liteQuery)

	return {
		data: liteDashboards,
		isLoading: liteDashboards.length === 0 && isLoading && !failed,
		failed,
		isFetching,
		refetch
	}
}

export function useDashboardAPI(dashboardId: string | null) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()

	const createDashboardMutation = useMutation({
		mutationFn: async (data: DashboardSavePayload) => {
			return await dashboardAPI.createDashboard(data, authorizedFetch)
		},
		onSuccess: (dashboard) => {
			queryClient.setQueryData(
				['pro-dashboard', 'dashboard', dashboardUrlKey(dashboard), isAuthenticated, user?.id],
				dashboard
			)
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'team-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
		}
	})

	const updateDashboardMutation = useUpdateDashboard(dashboardId, 'manual')

	// Sharing with the team or taking it back is an access change, kept apart from document saves.
	const moveDashboardTeamMutation = useMutation({
		mutationFn: async ({ id, teamId }: { id: string; teamId: string | null }) => {
			return await dashboardAPI.moveDashboardTeam(id, teamId, authorizedFetch)
		},
		onSuccess: (dashboard) => {
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'team-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
			// An admin who moved a dashboard back to its creator can no longer open it.
			if (dashboard.access?.role === 'none') {
				queryClient.removeQueries({ queryKey: ['pro-dashboard', 'dashboard', dashboard.id] })
				if (dashboard.slug) queryClient.removeQueries({ queryKey: ['pro-dashboard', 'dashboard', dashboard.slug] })
				void router.push('/pro?tab=team')
				return
			}
			queryClient.setQueriesData(
				{ queryKey: ['pro-dashboard', 'dashboard'], exact: false },
				(oldData: Dashboard | undefined) => (oldData?.id === dashboard.id ? dashboard : oldData)
			)
		}
	})

	// Mutation to delete dashboard
	const deleteDashboardMutation = useMutation({
		mutationFn: async ({ id }: { id: string; slug?: string }) => {
			return await dashboardAPI.deleteDashboard(id, authorizedFetch)
		},
		onSuccess: (_, deleted) => {
			// Keep a small session-local deletion marker so late writes cannot revive a deleted dashboard.
			const key = ['pro-dashboard-deleted', deleted.id, user?.id]
			queryClient.setQueryDefaults(key, { gcTime: Infinity })
			queryClient.setQueryData(key, true)
			for (const mutation of queryClient
				.getMutationCache()
				.findAll({ mutationKey: ['pro-dashboard-update', deleted.id, user?.id] })) {
				queryClient.getMutationCache().remove(mutation)
			}
			queryClient.removeQueries({ queryKey: ['pro-dashboard', 'dashboard', deleted.id] })
			if (deleted.slug) {
				queryClient.removeQueries({ queryKey: ['pro-dashboard', 'dashboard', deleted.slug] })
			}
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'team-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
			// Navigate away if current dashboard was deleted
			const routeKey = router.query.dashboardId
			if (routeKey === deleted.id || (deleted.slug && routeKey === deleted.slug)) {
				void router.push('/pro')
			}
		}
	})

	const loadDashboard = useCallback(
		(id: string) => {
			if (wasDashboardDeleted(queryClient, id, user?.id)) return Promise.resolve(null)
			return dashboardAPI
				.getDashboard(id, isAuthenticated ? authorizedFetch : undefined)
				.then((dashboard) => {
					return wasDashboardDeleted(queryClient, dashboard.id, user?.id) ? null : dashboard
				})
				.catch((error: unknown) => {
					if (error instanceof DashboardError && error.status === 404) return null
					throw error
				})
		},
		[isAuthenticated, authorizedFetch, queryClient, user?.id]
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
		// Mutations
		createDashboard: createDashboardMutation,
		updateDashboard: updateDashboardMutation,
		moveDashboardTeam: moveDashboardTeamMutation,
		deleteDashboard: deleteDashboardWithConfirmation,
		isDeleting: deleteDashboardMutation.isPending,

		// Actions
		loadDashboard,
		navigateToDashboard
	}
}

export interface DashboardUpdate {
	source?: 'autosave'
	id: string
	data: DashboardSavePayload
	changes?: Partial<DashboardSavePayload>
}

/** A saved dashboard. `mergeNotice` is set when the save collided with other edits and merged them. */
export type SavedDashboard = Dashboard & { mergeNotice?: string }

/** What a save has to tell the reader beyond its success. */
export type DashboardSaveNotices = { mergeNotice?: string; refreshPending: boolean }

/** Shown by whoever reports the save: a page action right away, a dialog once it has closed. */
export function showDashboardSaveNotices({ mergeNotice, refreshPending }: DashboardSaveNotices) {
	if (mergeNotice) {
		toast(mergeNotice, { id: 'dashboard-merged', duration: 8000, ariaProps: { role: 'status', 'aria-live': 'polite' } })
	}
	if (refreshPending) toast.error('Dashboard saved, but chart refresh setup is pending.')
}

export function useUpdateDashboard(dashboardId: string | null, source: 'manual' | 'autosave') {
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	return useMutation({
		mutationKey: ['pro-dashboard-update', dashboardId, user?.id],
		// A failed item draft must survive route remounts. Superseded attempts are pruned below.
		...(source === 'autosave' ? { gcTime: Infinity } : {}),
		onSettled: (_data, _error, request) => {
			if (source !== 'autosave') return
			for (const mutation of queryClient
				.getMutationCache()
				.findAll({ mutationKey: ['pro-dashboard-update', request.id, user?.id] })) {
				const variables = mutation.state.variables as DashboardUpdate | undefined
				if (variables?.source === 'autosave' && variables !== request && mutation.state.status !== 'pending') {
					queryClient.getMutationCache().remove(mutation)
				}
			}
		},
		// Settings and page remounts must not let an older save overtake a newer save.
		scope: { id: `pro-dashboard-update:${dashboardId}` },
		mutationFn: async ({ id, data, changes }: DashboardUpdate): Promise<SavedDashboard> => {
			if (wasDashboardDeleted(queryClient, id, user?.id))
				throw new DashboardError('Dashboard has been deleted', 404, 'This dashboard was deleted.')
			// The scope orders requests, but payloads must also preserve fields saved while waiting.
			const latest = cachedDashboard(queryClient, id, isAuthenticated, user?.id)
			const base = latest ? toDashboardSavePayload(latest) : undefined
			const payload = changes ? { ...(base ?? data), ...changes } : data
			const editedAt = latest?.editedAt
			try {
				return await dashboardAPI.updateDashboard(
					id,
					{ ...payload, items: toPersistedDashboardItems(payload.items) },
					authorizedFetch,
					editedAt
				)
			} catch (error) {
				if (!(error instanceof DashboardError) || error.status !== 409) throw error
				const server = await dashboardAPI.getDashboard(id, authorizedFetch)
				const items = mergeDashboardItems(base?.items ?? [], server.data.items ?? [], payload.items)
				const merged = await dashboardAPI.updateDashboard(
					id,
					{
						...toDashboardSavePayload(server),
						...dashboardPayloadChanges(base, payload),
						items: toPersistedDashboardItems(items)
					},
					authorizedFetch,
					server.editedAt
				)
				if (items === payload.items) return merged
				// On a team dashboard the last editor is most likely a teammate; personal ones are another tab.
				const editor = server.team ? server.editedBy?.displayName : undefined
				return {
					...merged,
					mergeNotice: editor
						? `${editor} changed this dashboard while you were editing. Your edits were merged.`
						: 'This dashboard was changed in another tab or session. Your edits were merged.'
				}
			}
		},
		onSuccess: ({ mergeNotice, ...dashboard }: SavedDashboard) => {
			// Autosave runs in the background and reports its own merge; a manual save leaves it to its caller, which may
			// still have a dialog open.
			if (source === 'autosave' && mergeNotice) showDashboardSaveNotices({ mergeNotice, refreshPending: false })
			if (wasDashboardDeleted(queryClient, dashboard.id, user?.id)) return
			queryClient.setQueryData(['pro-dashboard', 'dashboard', dashboard.id, isAuthenticated, user?.id], dashboard)
			queryClient.setQueriesData(
				{ queryKey: ['pro-dashboard', 'dashboard'], exact: false },
				(oldData: Dashboard | undefined) => (oldData?.id === dashboard.id ? dashboard : oldData)
			)
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'team-dashboards'] })
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
		}
	})
}

function cachedDashboard(client: QueryClient, id: string, isAuthenticated: boolean, userId: string | undefined) {
	return (
		client.getQueryData<Dashboard>(['pro-dashboard', 'dashboard', id, isAuthenticated, userId]) ??
		client
			.getQueriesData<Dashboard>({ queryKey: ['pro-dashboard', 'dashboard'], exact: false })
			.map(([, dashboard]) => dashboard)
			.find((dashboard) => dashboard?.id === id)
	)
}

export function getUnsavedDashboardChanges(
	client: QueryClient,
	dashboardId: string | null,
	userId: string | undefined
): Partial<DashboardSavePayload> | undefined {
	const state = client
		.getMutationCache()
		.findAll({
			mutationKey: ['pro-dashboard-update', dashboardId, userId],
			predicate: (mutation) => (mutation.state.variables as DashboardUpdate | undefined)?.source === 'autosave'
		})
		.at(-1)?.state as MutationState<Dashboard, Error, DashboardUpdate> | undefined
	return state?.status === 'pending' || state?.status === 'error' ? state.variables?.changes : undefined
}

export function wasDashboardDeleted(client: QueryClient, dashboardId: string, userId: string | undefined) {
	return client.getQueryData<boolean>(['pro-dashboard-deleted', dashboardId, userId]) === true
}

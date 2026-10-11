import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { useAuthContext } from '~/auth'
import { httpErrorMessage } from '~/utils/async'
import { useProDashboardDashboard, useProDashboardPermissions } from '../../ProDashboardAPIContext'
import type { SqlSnapshot } from '../../types'

export type ServerSqlSnapshot = SqlSnapshot & { error?: string }

export interface ServerSqlRunState {
	snapshot: SqlSnapshot | null
	isRefreshing: boolean
	error: string | null
	canRefresh: boolean
	refresh: () => void
}

export function useServerSqlRun(itemId: string, fallbackSnapshot: SqlSnapshot | null): ServerSqlRunState {
	const { dashboardId } = useProDashboardDashboard()
	const { isReadOnly } = useProDashboardPermissions()
	const { authorizedFetch } = useAuthContext()
	const forceRefreshRef = useRef(false)

	const query = useQuery<ServerSqlSnapshot>({
		queryKey: ['pro-dashboard', 'sql-run', dashboardId, itemId],
		queryFn: async () => {
			const refreshParam = forceRefreshRef.current ? '&refresh=1' : ''
			const url = `/api/private/pro-dashboard/sql-run?dashboardId=${encodeURIComponent(
				dashboardId ?? ''
			)}&itemId=${encodeURIComponent(itemId)}${refreshParam}`
			const response = (await authorizedFetch(url)) ?? (await fetch(url))
			const body = await response.json().catch(() => null)
			if (!response.ok) {
				throw new Error(body?.error ?? `Refresh failed with HTTP ${response.status}`)
			}
			return body as ServerSqlSnapshot
		},
		enabled: !!dashboardId,
		staleTime: 60 * 1000,
		retry: 1,
		refetchOnWindowFocus: false
	})

	const snapshot = query.data ?? fallbackSnapshot

	return {
		snapshot,
		isRefreshing: query.isFetching,
		error: query.data?.error ?? (query.error ? httpErrorMessage(query.error, "Couldn't refresh this query.") : null),
		canRefresh: !!dashboardId && !isReadOnly,
		refresh: () => {
			if (isReadOnly || query.isFetching) return
			forceRefreshRef.current = true
			void query.refetch().finally(() => {
				forceRefreshRef.current = false
			})
		}
	}
}

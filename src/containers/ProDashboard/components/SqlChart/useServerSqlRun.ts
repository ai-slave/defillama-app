import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { useProDashboardDashboard } from '../../ProDashboardAPIContext'
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
	const { authorizedFetch } = useAuthContext()

	const query = useQuery<ServerSqlSnapshot>({
		queryKey: ['pro-dashboard', 'sql-run', dashboardId, itemId],
		queryFn: async () => {
			const url = `/api/private/pro-dashboard/sql-run?dashboardId=${encodeURIComponent(
				dashboardId ?? ''
			)}&itemId=${encodeURIComponent(itemId)}`
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
		error: query.data?.error ?? (query.error instanceof Error ? query.error.message : null),
		canRefresh: !!dashboardId,
		refresh: () => {
			if (!query.isFetching) void query.refetch()
		}
	}
}

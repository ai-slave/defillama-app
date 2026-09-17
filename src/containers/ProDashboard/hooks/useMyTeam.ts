import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { AUTH_SERVER } from '~/constants'
import type { Team } from '~/containers/Account/Team/types'
import { handleSimpleFetchResponse } from '~/utils/async'
import type { DashboardTeam } from '../dashboardTypes'

/**
 * The viewer's team as `{ id, name }`, sharing the Account page's `['team', userId]` cache entry
 * so opening a dashboard never issues a second `GET /team` when the account page already did.
 */
export function useMyTeam(): DashboardTeam | null {
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()
	const { data } = useQuery({
		queryKey: ['team', user?.id],
		queryFn: async (): Promise<Team | null> => {
			if (!isAuthenticated) return null
			const response = await authorizedFetch(`${AUTH_SERVER}/team`)
			if (!response) return null
			const payload = await handleSimpleFetchResponse(response).then((res) => res.json())
			return payload?.team ?? null
		},
		enabled: isAuthenticated && !!user?.id,
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false
	})
	return data ? { id: data.id, name: data.name } : null
}

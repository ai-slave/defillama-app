import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { ReaderError } from '~/utils/async'
import { liteDashboardsQuery } from './useDashboardAPI'

export const FREE_TIER_MAX_DASHBOARDS = 1

export function useFreeTierStatus() {
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, hasActiveSubscription, user } = useAuthContext()
	const isFreeUser = isAuthenticated && !hasActiveSubscription
	// Only a list the server returned counts. Stored dashboards are the last known list, and a failed read is unknown.
	const { data: dashboards } = useQuery({
		...liteDashboardsQuery(authorizedFetch, user?.id),
		enabled: isAuthenticated && !!user?.id
	})
	const isAtDashboardLimit = isFreeUser && !!dashboards && dashboards.length >= FREE_TIER_MAX_DASHBOARDS

	// Creating decides on the server's count, so an unknown count refuses instead of allowing a dashboard.
	const checkCanCreateDashboard = async () => {
		if (hasActiveSubscription) return true
		if (!isFreeUser) return false
		const current = await queryClient.fetchQuery(liteDashboardsQuery(authorizedFetch, user?.id)).catch(() => {
			throw new ReaderError("Couldn't check how many dashboards you have. Try again.")
		})
		return current.length < FREE_TIER_MAX_DASHBOARDS
	}

	return { isFreeUser, isAtDashboardLimit, checkCanCreateDashboard }
}

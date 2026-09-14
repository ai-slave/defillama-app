import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '../dashboardTypes'

export type DashboardReadOnlyReason =
	| 'loading'
	| 'dashboard-loading'
	| 'not-owner'
	| 'subscription'
	| 'view-mode'
	| null

interface DashboardPermissions {
	isReadOnly: boolean
	isOwner: boolean
	dashboardOwnerId: string | null
	reason: DashboardReadOnlyReason
}

export function useDashboardPermissions(dashboard: Dashboard | null): DashboardPermissions {
	const { user, isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const userLoading = loaders.sessionLoading

	return useMemo<DashboardPermissions>(() => {
		if (userLoading) {
			return {
				isReadOnly: true,
				isOwner: false,
				dashboardOwnerId: dashboard?.user ?? null,
				reason: 'loading'
			}
		}

		// New dashboard (no existing dashboard loaded)
		if (!dashboard) {
			return {
				isReadOnly: !isAuthenticated,
				isOwner: isAuthenticated,
				dashboardOwnerId: null,
				reason: isAuthenticated ? null : 'not-owner'
			}
		}

		// Public dashboards: any authenticated owner can edit (free or subscribed)
		if (dashboard.visibility === 'public') {
			const isOwner = isAuthenticated && user?.id === dashboard.user
			return {
				isReadOnly: !isOwner,
				isOwner,
				dashboardOwnerId: dashboard.user ?? null,
				reason: isOwner ? null : 'not-owner'
			}
		}

		// Private dashboards: still require subscription for edit access
		const isOwner = isAuthenticated && user?.id === dashboard.user
		return {
			isReadOnly: !isOwner || !hasActiveSubscription,
			isOwner: isOwner && hasActiveSubscription,
			dashboardOwnerId: dashboard.user ?? null,
			reason: !isOwner ? 'not-owner' : hasActiveSubscription ? null : 'subscription'
		}
	}, [dashboard, user?.id, hasActiveSubscription, isAuthenticated, userLoading])
}

import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import type { Dashboard, DashboardAccess, DashboardRole, DashboardTeam } from '../dashboardTypes'

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
	role: DashboardRole
	canEdit: boolean
	canDelete: boolean
	canMove: boolean
	team: DashboardTeam | null
}

function fromServerAccess(dashboard: Dashboard, access: DashboardAccess, isOwner: boolean): DashboardPermissions {
	return {
		isReadOnly: !access.canEdit,
		isOwner,
		dashboardOwnerId: dashboard.user ?? null,
		reason: access.canEdit ? null : access.role === 'none' ? 'not-owner' : 'subscription',
		role: access.role,
		canEdit: access.canEdit,
		canDelete: access.canDelete,
		canMove: access.canMove,
		team: dashboard.team ?? null
	}
}

function ownerOnly(
	dashboard: Dashboard | null,
	isOwner: boolean,
	isReadOnly: boolean,
	reason: DashboardReadOnlyReason
): DashboardPermissions {
	return {
		isReadOnly,
		isOwner,
		dashboardOwnerId: dashboard?.user ?? null,
		reason,
		role: isOwner ? 'owner' : 'none',
		canEdit: !isReadOnly,
		canDelete: isOwner,
		canMove: isOwner,
		team: dashboard?.team ?? null
	}
}

export function useDashboardPermissions(dashboard: Dashboard | null): DashboardPermissions {
	const { user, isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const userLoading = loaders.sessionLoading

	return useMemo<DashboardPermissions>(() => {
		if (userLoading) {
			return ownerOnly(dashboard, false, true, 'loading')
		}

		// New dashboard (no existing dashboard loaded)
		if (!dashboard) {
			return ownerOnly(null, isAuthenticated, !isAuthenticated, isAuthenticated ? null : 'not-owner')
		}

		const isCreator = isAuthenticated && user?.id === dashboard.user

		// The server resolves team membership and seats; its answer wins whenever it is present.
		if (dashboard.access && isAuthenticated) {
			return fromServerAccess(dashboard, dashboard.access, isCreator)
		}

		// Public dashboards: any authenticated owner can edit (free or subscribed)
		if (dashboard.visibility === 'public') {
			return ownerOnly(dashboard, isCreator, !isCreator, isCreator ? null : 'not-owner')
		}

		// Private dashboards: still require subscription for edit access
		const permissions = ownerOnly(
			dashboard,
			isCreator && hasActiveSubscription,
			!isCreator || !hasActiveSubscription,
			!isCreator ? 'not-owner' : hasActiveSubscription ? null : 'subscription'
		)
		return { ...permissions, canDelete: isCreator, canMove: isCreator }
	}, [dashboard, user?.id, hasActiveSubscription, isAuthenticated, userLoading])
}

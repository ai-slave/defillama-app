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

export type DashboardViewer = {
	userId: string | undefined
	isAuthenticated: boolean
	hasActiveSubscription: boolean
	sessionLoading: boolean
}

export function getDashboardPermissions(dashboard: Dashboard | null, viewer: DashboardViewer): DashboardPermissions {
	const { userId, isAuthenticated, hasActiveSubscription } = viewer
	if (viewer.sessionLoading) {
		return ownerOnly(dashboard, false, true, 'loading')
	}

	// New dashboard (no existing dashboard loaded)
	if (!dashboard) {
		return ownerOnly(null, isAuthenticated, !isAuthenticated, isAuthenticated ? null : 'not-owner')
	}

	const isCreator = isAuthenticated && userId === dashboard.user

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
}

export function useDashboardPermissions(dashboard: Dashboard | null): DashboardPermissions {
	const { user, isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const userId = user?.id
	const sessionLoading = loaders.sessionLoading

	return useMemo<DashboardPermissions>(
		() => getDashboardPermissions(dashboard, { userId, isAuthenticated, hasActiveSubscription, sessionLoading }),
		[dashboard, userId, hasActiveSubscription, isAuthenticated, sessionLoading]
	)
}

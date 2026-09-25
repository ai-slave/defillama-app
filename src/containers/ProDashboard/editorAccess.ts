import type { Dashboard } from './dashboardTypes'

/** Where a restored session must leave the editor for, or null when it may stay. */
export function getEditorExitPath({
	dashboardId,
	isAuthenticated,
	userId,
	dashboard
}: {
	dashboardId: string
	isAuthenticated: boolean
	userId: string | undefined
	dashboard: Pick<Dashboard, 'user' | 'slug' | 'access'> | null
}): string | null {
	if (!isAuthenticated) return `/pro/${dashboardId}`
	if (!dashboard || !userId) return null
	// Server-resolved access covers team members; without it only the creator may stay in edit mode.
	const cannotEdit = dashboard.access
		? !dashboard.access.canEdit && dashboard.access.role === 'none'
		: dashboard.user !== userId
	return cannotEdit ? `/pro/${dashboard.slug ?? dashboardId}` : null
}

import type { Dashboard, DashboardMode } from './dashboardTypes'

export function getDashboardHydrationState({
	hasDashboardId,
	hasInitialDashboard,
	authReady,
	streamIsDone,
	hasStreamDashboard
}: {
	hasDashboardId: boolean
	hasInitialDashboard: boolean
	authReady: boolean
	streamIsDone: boolean
	hasStreamDashboard: boolean
}) {
	if (!hasDashboardId) {
		return {
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		}
	}

	const streamSettled = authReady && streamIsDone
	const trustedStreamComplete = streamSettled && hasStreamDashboard
	const canFetchUnseededConfig = streamSettled && !hasStreamDashboard && !hasInitialDashboard
	const canUseInitialFallback = streamSettled && !hasStreamDashboard && hasInitialDashboard

	return {
		dashboardReady: hasInitialDashboard || trustedStreamComplete || canFetchUnseededConfig,
		streamDone: trustedStreamComplete || canUseInitialFallback || canFetchUnseededConfig,
		streamHasResolved: hasInitialDashboard || streamSettled,
		shouldFetchTrustedDashboardFallback: canUseInitialFallback
	}
}

export function isDashboardEditingLocked({
	isReadOnly,
	hasDashboardId,
	hasCurrentDashboard,
	mode,
	hasInitialDashboard,
	hasTrustedDashboard
}: {
	isReadOnly: boolean
	hasDashboardId: boolean
	hasCurrentDashboard: boolean
	mode: DashboardMode
	hasInitialDashboard: boolean
	hasTrustedDashboard: boolean
}) {
	return (
		isReadOnly ||
		(hasDashboardId && (!hasCurrentDashboard || (mode === 'edit' && hasInitialDashboard && !hasTrustedDashboard)))
	)
}

export function getDashboardUpdatedAtMs(dashboard?: Dashboard | null) {
	if (!dashboard) return undefined
	const updatedAt = Date.parse(dashboard.editedAt || dashboard.updated || dashboard.created || '')
	return Number.isFinite(updatedAt) ? updatedAt : undefined
}

export function shouldApplyTrustedDashboard({
	hasPendingSave,
	incomingUpdatedAt,
	appliedUpdatedAt
}: {
	hasPendingSave: boolean
	incomingUpdatedAt: number | undefined
	appliedUpdatedAt: number | undefined
}) {
	return (
		!hasPendingSave &&
		(incomingUpdatedAt === undefined || appliedUpdatedAt === undefined || incomingUpdatedAt >= appliedUpdatedAt)
	)
}

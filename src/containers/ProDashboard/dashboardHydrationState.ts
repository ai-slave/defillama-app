import type { DashboardMode } from './dashboardTypes'

export function getDashboardHydrationState({
	hasDashboardId,
	hasInitialDashboard,
	authReady,
	streamIsDone,
	hasStreamDashboard,
	mode
}: {
	hasDashboardId: boolean
	hasInitialDashboard: boolean
	authReady: boolean
	streamIsDone: boolean
	hasStreamDashboard: boolean
	mode: DashboardMode
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
	const canFetchUnseededEditConfig = streamSettled && !hasStreamDashboard && !hasInitialDashboard && mode === 'edit'
	// A server-authorized render seed may safely fall back to per-source queries, but an
	// unseeded view must stay blocked when the stream never supplies its trusted config.
	const canUseInitialFallback = streamSettled && !hasStreamDashboard && hasInitialDashboard

	return {
		dashboardReady: hasInitialDashboard || trustedStreamComplete || canFetchUnseededEditConfig,
		streamDone: trustedStreamComplete || canUseInitialFallback || canFetchUnseededEditConfig,
		streamHasResolved: hasInitialDashboard || streamSettled,
		shouldFetchTrustedDashboardFallback: mode === 'edit' && canUseInitialFallback
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

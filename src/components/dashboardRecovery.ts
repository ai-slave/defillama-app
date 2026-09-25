import type { MutationStatus } from '@tanstack/react-query'
import type { DashboardUpdate } from '~/containers/ProDashboard/hooks/useDashboardAPI'

export interface DashboardSaveAttempt {
	userId: unknown
	status: MutationStatus
	request: DashboardUpdate
}

/**
 * What the save guard owes the signed-in account: whether leaving the page loses a write, and which
 * failed drafts get a recovery notice. Attempts are in mutation order, so the last autosave per
 * dashboard is its current state. `editing` is the dashboard open in the editor, by route key and by
 * the id that key resolved to; its own editor already shows the draft.
 */
export function getDashboardRecovery(
	attempts: Array<DashboardSaveAttempt>,
	userId: string | undefined,
	editing: { routeKey: unknown; dashboardId: string | undefined } | null
): { unsaved: boolean; notices: Array<DashboardUpdate> } {
	const pending = new Set<string>()
	const latest = new Map<string, DashboardSaveAttempt>()
	for (const attempt of attempts) {
		if (attempt.userId !== userId) continue
		if (attempt.status === 'pending') pending.add(attempt.request.id)
		if (attempt.request?.source === 'autosave') latest.set(attempt.request.id, attempt)
	}
	const notices: Array<DashboardUpdate> = []
	let failed = false
	for (const attempt of latest.values()) {
		if (attempt.status !== 'error') continue
		failed = true
		const { id } = attempt.request
		if (pending.has(id) || (editing && (editing.routeKey === id || editing.dashboardId === id))) continue
		notices.push(attempt.request)
	}
	return { unsaved: pending.size > 0 || failed, notices }
}

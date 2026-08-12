export interface SessionActivityFields {
	lastActivity?: string | null
	createdAt?: string | null
	pinnedAt?: string | null
}

function activityTime(session: SessionActivityFields): number {
	const activity = Date.parse(session.lastActivity ?? '')
	if (Number.isFinite(activity)) return activity
	const created = Date.parse(session.createdAt ?? '')
	return Number.isFinite(created) ? created : 0
}

function pinTime(session: SessionActivityFields): number {
	const pinned = Date.parse(session.pinnedAt ?? '')
	return Number.isFinite(pinned) ? pinned : 0
}

export function compareSessionsByActivity(a: SessionActivityFields, b: SessionActivityFields): number {
	const byActivity = activityTime(b) - activityTime(a)
	if (byActivity !== 0) return byActivity
	return pinTime(b) - pinTime(a)
}

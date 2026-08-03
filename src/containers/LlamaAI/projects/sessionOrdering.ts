import type { ProjectChatSession } from './types'

export function orderVisibleProjectSessions(
	sessions: ProjectChatSession[] | undefined,
	currentSessionId: string | null,
	limit: number
): ProjectChatSession[] {
	if (!sessions) return []
	const pinned = sessions
		.filter((s) => s.isPinned)
		.sort((a, b) => new Date(b.pinnedAt || 0).getTime() - new Date(a.pinnedAt || 0).getTime())
	const unpinned = sessions.filter((s) => !s.isPinned)
	const ordered = [...pinned, ...unpinned]
	const next = ordered.slice(0, limit)
	if (!currentSessionId || next.some((s) => s.sessionId === currentSessionId)) return next
	const currentSession = ordered.find((s) => s.sessionId === currentSessionId)
	if (!currentSession) return next
	if (next.length < limit) return [...next, currentSession]
	return [...next.slice(0, limit - 1), currentSession]
}

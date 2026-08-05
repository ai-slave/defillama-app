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
	const recencySlots = Math.max(2, limit - pinned.length)
	const next = [...pinned, ...unpinned.slice(0, recencySlots)]
	if (!currentSessionId || next.some((s) => s.sessionId === currentSessionId)) return next
	const currentSession = sessions.find((s) => s.sessionId === currentSessionId)
	if (!currentSession) return next
	return [...next, currentSession]
}

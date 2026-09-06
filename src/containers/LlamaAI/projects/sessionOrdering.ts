import { compareSessionsByActivity } from '~/containers/LlamaAI/utils/sessionActivityOrder'
import type { ProjectChatSession } from './types'

export function orderVisibleProjectSessions(
	sessions: Array<ProjectChatSession> | undefined,
	currentSessionId: string | null,
	limit: number
): Array<ProjectChatSession> {
	if (!sessions) return []
	const pinned = sessions.filter((s) => s.isPinned).sort(compareSessionsByActivity)
	const unpinned = sessions.filter((s) => !s.isPinned).sort(compareSessionsByActivity)
	const recencySlots = Math.max(2, limit - pinned.length)
	const next = [...pinned, ...unpinned.slice(0, recencySlots)]
	if (!currentSessionId || next.some((s) => s.sessionId === currentSessionId)) return next
	const currentSession = sessions.find((s) => s.sessionId === currentSessionId)
	if (!currentSession) return next
	return [...next, currentSession]
}

export function bumpProjectSessionActivity(
	sessions: Array<ProjectChatSession> | undefined,
	sessionId: string,
	lastActivity: string
): Array<ProjectChatSession> | undefined {
	if (!sessions?.some((session) => session.sessionId === sessionId)) return sessions
	return sessions.map((session) => (session.sessionId === sessionId ? { ...session, lastActivity } : session))
}

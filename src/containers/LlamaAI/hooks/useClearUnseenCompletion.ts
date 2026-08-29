import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useAuthContext } from '~/auth'
import { isChatSurfaceAttended, type ChatAttention } from '~/containers/LlamaAI/chatAttention'
import {
	SESSIONS_QUERY_KEY,
	type SessionListInfiniteData,
	updateSessionInInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import { projectSessionsKey } from '~/containers/LlamaAI/projects/queryKeys'
import type { ProjectChatSession } from '~/containers/LlamaAI/projects/types'

interface UseClearUnseenCompletionOptions {
	attention?: ChatAttention
	projectId?: string | null
	hasUnseenCompletion?: boolean
}

export function useClearUnseenCompletion(options?: UseClearUnseenCompletionOptions) {
	const queryClient = useQueryClient()
	const { user } = useAuthContext()

	const clearUnseenCompletion = useCallback(
		(sessionId: string, projectId?: string | null) => {
			if (user) {
				queryClient.setQueryData<SessionListInfiniteData | undefined>([SESSIONS_QUERY_KEY, user.id], (old) =>
					updateSessionInInfiniteData(old, sessionId, (session) => ({ ...session, hasUnseenCompletion: false }))
				)
			}

			if (projectId) {
				queryClient.setQueryData<ProjectChatSession[]>(projectSessionsKey(projectId), (old) =>
					old?.map((session) =>
						session.sessionId === sessionId ? { ...session, hasUnseenCompletion: false } : session
					)
				)
			}
		},
		[queryClient, user]
	)

	const sessionId = options?.attention?.sessionId ?? null
	const uncovered = options?.attention?.uncovered ?? false
	const projectId = options?.projectId
	const hasUnseenCompletion = options?.hasUnseenCompletion === true

	useEffect(() => {
		if (!sessionId || !hasUnseenCompletion) return
		const tryClear = () => {
			if (!isChatSurfaceAttended({ uncovered })) return
			clearUnseenCompletion(sessionId, projectId)
		}
		tryClear()
		document.addEventListener('visibilitychange', tryClear)
		window.addEventListener('focus', tryClear)
		return () => {
			document.removeEventListener('visibilitychange', tryClear)
			window.removeEventListener('focus', tryClear)
		}
	}, [clearUnseenCompletion, hasUnseenCompletion, projectId, sessionId, uncovered])

	return clearUnseenCompletion
}

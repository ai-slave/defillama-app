import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import {
	findSessionInInfiniteData,
	SESSIONS_QUERY_KEY,
	updateSessionInInfiniteData,
	type SessionListInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import {
	mutationActionError,
	SESSION_WRITE_KEY,
	useInvalidateSessionWrites
} from '~/containers/LlamaAI/hooks/sessionMutationCache'
import { withSessionWriteScope } from './sessionWriteScope'

// Its own hook so a session row can rename itself without instantiating every session mutation.
export function useUpdateSessionTitle() {
	const { user, authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const invalidateSessionWrites = useInvalidateSessionWrites()
	const sessionsKey = [SESSIONS_QUERY_KEY, user?.id]

	// Rename optimistically so the sidebar updates immediately.
	return useMutation({
		mutationKey: [SESSION_WRITE_KEY, user?.id],
		mutationFn: ({ sessionId, title }: { sessionId: string; title: string; projectId?: string | null }) =>
			withSessionWriteScope(queryClient, `${user?.id}:${sessionId}:title`, async () => {
				await queryClient.cancelQueries({ queryKey: sessionsKey })
				const previous = findSessionInInfiniteData(
					queryClient.getQueryData<SessionListInfiniteData>(sessionsKey),
					sessionId
				)
				queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
					updateSessionInInfiniteData(old, sessionId, (session) => ({ ...session, title }))
				)
				try {
					await llamaAIRequest(authorizedFetch, `/user/sessions/${sessionId}/title`, { method: 'PUT', json: { title } })
				} catch (error) {
					if (previous) {
						queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
							updateSessionInInfiniteData(old, sessionId, (session) =>
								session.title === title ? { ...session, title: previous.title } : session
							)
						)
					}
					throw mutationActionError("Couldn't update the chat title.", error)
				}
			}),
		onSettled: invalidateSessionWrites
	})
}

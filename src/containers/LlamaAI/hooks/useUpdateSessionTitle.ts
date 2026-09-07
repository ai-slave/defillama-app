import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import {
	SESSIONS_QUERY_KEY,
	updateSessionInInfiniteData,
	type SessionListInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import { mutationActionError, useInvalidateProjectSessions } from '~/containers/LlamaAI/hooks/sessionMutationCache'

// Its own hook so a session row can rename itself without instantiating every session mutation.
export function useUpdateSessionTitle() {
	const { user, authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const invalidateProjectSessions = useInvalidateProjectSessions()
	const sessionsKey = [SESSIONS_QUERY_KEY, user?.id]

	// Rename optimistically so the sidebar updates immediately.
	return useMutation({
		mutationFn: async ({ sessionId, title }: { sessionId: string; title: string; projectId?: string | null }) => {
			try {
				await llamaAIRequest(authorizedFetch, `/user/sessions/${sessionId}/title`, {
					method: 'PUT',
					json: { title }
				})
			} catch (error) {
				throw mutationActionError('Failed to update session title', error)
			}
		},
		onMutate: async ({ sessionId, title }) => {
			await queryClient.cancelQueries({ queryKey: sessionsKey })
			const previous = queryClient.getQueryData<SessionListInfiniteData>(sessionsKey)
			queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
				updateSessionInInfiniteData(old, sessionId, (session) => ({ ...session, title }))
			)
			return { previous }
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionsKey, context.previous)
			}
		},
		onSettled: (_data, _error, variables) => {
			if (variables.projectId) {
				invalidateProjectSessions(variables.projectId)
				return
			}
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})
}

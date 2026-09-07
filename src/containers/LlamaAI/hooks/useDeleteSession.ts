import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import {
	removeSessionFromInfiniteData,
	SESSIONS_QUERY_KEY,
	type SessionListInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import { mutationActionError, useInvalidateProjectSessions } from '~/containers/LlamaAI/hooks/sessionMutationCache'

// Its own hook so a caller that only deletes does not instantiate every session mutation.
export function useDeleteSession() {
	const { user, authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const invalidateProjectSessions = useInvalidateProjectSessions()
	const sessionsKey = [SESSIONS_QUERY_KEY, user?.id]

	return useMutation({
		mutationFn: async ({ sessionId }: { sessionId: string; projectId?: string | null }) => {
			try {
				await llamaAIRequest(authorizedFetch, `/user/sessions/${sessionId}`, { method: 'DELETE' })
			} catch (error) {
				throw mutationActionError('Failed to delete session', error)
			}
		},
		onMutate: async ({ sessionId }) => {
			await queryClient.cancelQueries({ queryKey: sessionsKey })
			const previous = queryClient.getQueryData<SessionListInfiniteData>(sessionsKey)
			queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
				removeSessionFromInfiniteData(old, sessionId)
			)
			return { previous }
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionsKey, context.previous)
			}
		},
		onSettled: (_data, _error, variables) => {
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
			if (variables.projectId) invalidateProjectSessions(variables.projectId)
		}
	})
}

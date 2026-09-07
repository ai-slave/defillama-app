import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { llamaAIRequest } from '~/containers/LlamaAI/api/transport'
import {
	removeSessionFromInfiniteData,
	SESSIONS_QUERY_KEY,
	type SessionListInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import {
	mutationActionError,
	SESSION_WRITE_KEY,
	useInvalidateSessionWrites
} from '~/containers/LlamaAI/hooks/sessionMutationCache'

// Its own hook so a caller that only deletes does not instantiate every session mutation.
export function useDeleteSession() {
	const { user, authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const invalidateSessionWrites = useInvalidateSessionWrites()
	const sessionsKey = [SESSIONS_QUERY_KEY, user?.id]

	return useMutation({
		mutationKey: [SESSION_WRITE_KEY, user?.id],
		mutationFn: async ({ sessionId }: { sessionId: string; projectId?: string | null }) => {
			try {
				await llamaAIRequest(authorizedFetch, `/user/sessions/${sessionId}`, { method: 'DELETE' })
			} catch (error) {
				throw mutationActionError('Failed to delete session', error)
			}
		},
		// Keep the row and its confirmation available until the server accepts deletion.
		onSuccess: (_data, { sessionId }) => {
			queryClient.setQueryData(sessionsKey, (old: SessionListInfiniteData | undefined) =>
				removeSessionFromInfiniteData(old, sessionId)
			)
		},
		onSettled: invalidateSessionWrites
	})
}

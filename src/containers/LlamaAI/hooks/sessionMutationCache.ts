import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuthContext } from '~/auth'
import { isProjectSessionsQueryKey, projectSessionsKey } from '~/containers/LlamaAI/projects/queryKeys'
import { SESSIONS_QUERY_KEY } from './sessionListCache'

// A session can be listed by the sidebar and by its project, so both caches follow every write.
export function useInvalidateProjectSessions() {
	const queryClient = useQueryClient()
	return useCallback(
		(projectId?: string | null) => {
			if (projectId) {
				void queryClient.invalidateQueries({ queryKey: projectSessionsKey(projectId) })
				return
			}
			void queryClient.invalidateQueries({ predicate: (query) => isProjectSessionsQueryKey(query.queryKey) })
		},
		[queryClient]
	)
}

export const SESSION_WRITE_KEY = 'llamaai-session-write'

// Refetch only after the last overlapping write, so a response cannot erase another optimistic edit.
export function useInvalidateSessionWrites() {
	const queryClient = useQueryClient()
	const { user } = useAuthContext()
	return useCallback(() => {
		if (queryClient.isMutating({ mutationKey: [SESSION_WRITE_KEY, user?.id] }) > 1) return
		void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY, user?.id] })
		void queryClient.invalidateQueries({ predicate: (query) => isProjectSessionsQueryKey(query.queryKey) })
	}, [queryClient, user?.id])
}

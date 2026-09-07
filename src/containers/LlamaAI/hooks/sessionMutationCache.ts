import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { isProjectSessionsQueryKey, projectSessionsKey } from '~/containers/LlamaAI/projects/queryKeys'
import { getErrorMessage } from '~/utils/error'

export function mutationActionError(action: string, error: unknown) {
	return new Error(`${action}: ${getErrorMessage(error)}`)
}

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

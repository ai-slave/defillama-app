import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import type { EntityQuestionsResponse } from '~/containers/LlamaAI/types'

const getEntityQuestionsQueryKey = (
	entitySlug: string,
	entityType: 'protocol' | 'chain' | 'page',
	context?: Record<string, unknown>
) => ['llamaai', 'entity-questions', entitySlug, entityType, context ?? null] as const

export function useEntityQuestions(
	entitySlug: string | null,
	entityType: 'protocol' | 'chain' | 'page' | null,
	enabled = true,
	context?: Record<string, unknown>,
	/** Keep the last set on screen while a changed context loads its own, instead of a skeleton. */
	options: { keepPreviousData?: boolean } = {}
): UseQueryResult<EntityQuestionsResponse> {
	return useQuery({
		queryKey: getEntityQuestionsQueryKey(entitySlug ?? '', entityType ?? 'protocol', context),
		queryFn: () => fetchEntityQuestions(entitySlug!, entityType!, context),
		enabled: enabled && !!entitySlug && !!entityType,
		...(options.keepPreviousData ? { placeholderData: keepPreviousData } : {}),
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})
}

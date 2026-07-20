import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import type { EntityQuestionsResponse } from '~/containers/LlamaAI/types'
import { optionalPageData } from '~/utils/optionalPageData'

const EMPTY_ENTITY_QUESTIONS: EntityQuestionsResponse = { questions: [], suggestGlobal: false }

export function fetchOptionalEntityQuestions(
	entity: string,
	entityType: 'protocol' | 'chain',
	cacheKey: string
): Promise<EntityQuestionsResponse> {
	return optionalPageData(
		`${entityType}:${cacheKey}:entity_questions`,
		() => fetchEntityQuestions(entity, entityType, undefined, { throwOnError: true }),
		EMPTY_ENTITY_QUESTIONS
	)
}

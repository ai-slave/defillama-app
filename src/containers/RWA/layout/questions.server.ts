import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import { buildRwaQuestionsContext, getRwaQuestionsEntitySlug } from './questions'

/** The Ask strip's questions for one /rwa page, fetched at build as /stablecoins does; empty when the server fails. */
export async function fetchRwaPageQuestions(
	input: Parameters<typeof buildRwaQuestionsContext>[0]
): Promise<Array<string>> {
	const { questions } = await fetchEntityQuestions(
		getRwaQuestionsEntitySlug(input.kind, input.scopeName),
		'page',
		buildRwaQuestionsContext(input)
	)
	return questions
}

import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchEntityQuestions: vi.fn(),
	optionalPageData: vi.fn(async (_label: string, run: () => Promise<unknown>, fallback: unknown) => {
		try {
			return await run()
		} catch {
			return fallback
		}
	})
}))

vi.mock('~/containers/LlamaAI/api', () => ({
	fetchEntityQuestions: mocks.fetchEntityQuestions
}))

vi.mock('~/utils/optionalPageData', () => ({
	optionalPageData: mocks.optionalPageData
}))

import { fetchOptionalEntityQuestions } from '~/containers/LlamaAI/entityQuestions'

describe('fetchOptionalEntityQuestions', () => {
	beforeEach(() => vi.clearAllMocks())

	test('uses the entity-specific cache key and strict API mode', async () => {
		mocks.fetchEntityQuestions.mockResolvedValueOnce({ questions: ['Question'], suggestGlobal: false })

		await expect(fetchOptionalEntityQuestions('Ethereum', 'chain', 'ethereum')).resolves.toEqual({
			questions: ['Question'],
			suggestGlobal: false
		})
		expect(mocks.optionalPageData).toHaveBeenCalledWith('chain:ethereum:entity_questions', expect.any(Function), {
			questions: [],
			suggestGlobal: false
		})
		expect(mocks.fetchEntityQuestions).toHaveBeenCalledWith('Ethereum', 'chain', undefined, { throwOnError: true })
	})

	test('returns an empty optional payload when the API fails', async () => {
		mocks.fetchEntityQuestions.mockRejectedValueOnce(new Error('questions unavailable'))

		await expect(fetchOptionalEntityQuestions('aave', 'protocol', 'aave')).resolves.toEqual({
			questions: [],
			suggestGlobal: false
		})
	})
})

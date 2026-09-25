import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchOptionalEntityQuestions } from '~/containers/LlamaAI/entityQuestions'
import { fetchJson } from '~/utils/async'

vi.mock('~/utils/async', () => ({ fetchJson: vi.fn() }))

afterEach(() => vi.mocked(fetchJson).mockReset())

describe('fetchOptionalEntityQuestions', () => {
	test('asks for questions about the page entity and returns them', async () => {
		vi.mocked(fetchJson).mockResolvedValueOnce({ questions: ['What is Ethereum TVL?'] })

		await expect(fetchOptionalEntityQuestions('Ethereum', 'chain', 'ethereum')).resolves.toEqual({
			questions: ['What is Ethereum TVL?'],
			suggestGlobal: false
		})
		expect(vi.mocked(fetchJson).mock.calls[0][0]).toBe(
			'https://ai.llama.fi/suggested-questions?entity=Ethereum&entityType=chain'
		)
	})

	test('renders the page without questions when the API fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.mocked(fetchJson).mockRejectedValueOnce(new Error('questions unavailable'))

		await expect(fetchOptionalEntityQuestions('aave', 'protocol', 'aave')).resolves.toEqual({
			questions: [],
			suggestGlobal: false
		})
	})
})

import { expect, test, vi } from 'vitest'
import { fetchOptionalEntityQuestions } from '~/containers/LlamaAI/entityQuestions'
import { fetchJson } from '~/utils/async'

vi.mock('~/utils/async', () => ({ fetchJson: vi.fn() }))

test('renders the page without questions when the API fails', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => {})
	vi.mocked(fetchJson).mockRejectedValueOnce(new Error('questions unavailable'))

	await expect(fetchOptionalEntityQuestions('aave', 'protocol', 'aave')).resolves.toEqual({
		questions: [],
		suggestGlobal: false
	})
})

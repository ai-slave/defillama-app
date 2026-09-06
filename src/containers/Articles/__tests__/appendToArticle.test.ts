import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../api', () => ({
	getOwnedArticle: vi.fn(),
	updateArticle: vi.fn(),
	createArticle: vi.fn()
}))

import { createArticle, getOwnedArticle, updateArticle } from '../api'
import { appendBlocksToArticle, createArticleWithBlocks } from '../import/appendToArticle'

const mockGetOwned = getOwnedArticle as ReturnType<typeof vi.fn>
const mockUpdate = updateArticle as ReturnType<typeof vi.fn>
const mockCreate = createArticle as ReturnType<typeof vi.fn>

const authorizedFetch = vi.fn()
const newBlocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'appended' }] }]

describe('appendBlocksToArticle', () => {
	beforeEach(() => {
		mockGetOwned.mockReset()
		mockUpdate.mockReset()
	})

	test('appends blocks at the end of the existing doc and passes every other field through', async () => {
		const existing = {
			id: 'a1',
			title: 'Weekly Alpha #3',
			slug: 'weekly-alpha-3',
			status: 'draft',
			tags: ['dex'],
			section: 'markets',
			contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'intro' }] }] }
		}
		mockGetOwned.mockResolvedValue(existing)
		mockUpdate.mockImplementation(async (_id, article) => article)

		await appendBlocksToArticle('a1', newBlocks, authorizedFetch)

		expect(mockGetOwned).toHaveBeenCalledWith('a1', authorizedFetch)
		const [id, saved] = mockUpdate.mock.calls[0]
		expect(id).toBe('a1')
		expect(saved.contentJson.content).toHaveLength(2)
		expect(saved.contentJson.content[1]).toEqual(newBlocks[0])
		expect(saved.title).toBe('Weekly Alpha #3')
		expect(saved.tags).toEqual(['dex'])
		expect(saved.section).toBe('markets')
	})

	test('handles a draft with empty content', async () => {
		mockGetOwned.mockResolvedValue({ id: 'a2', title: 'x', slug: 'x', contentJson: { type: 'doc' } })
		mockUpdate.mockImplementation(async (_id, article) => article)

		await appendBlocksToArticle('a2', newBlocks, authorizedFetch)

		const [, saved] = mockUpdate.mock.calls[0]
		expect(saved.contentJson.content).toEqual(newBlocks)
	})
})

describe('createArticleWithBlocks', () => {
	beforeEach(() => mockCreate.mockReset())

	test('creates a draft whose content is exactly the imported blocks', async () => {
		mockCreate.mockImplementation(async (article) => ({ ...article, id: 'new1' }))

		const result = await createArticleWithBlocks('Uniswap fee report', newBlocks, authorizedFetch)

		const [article, fetcher] = mockCreate.mock.calls[0]
		expect(fetcher).toBe(authorizedFetch)
		expect(article.title).toBe('Uniswap fee report')
		expect(article.status).toBe('draft')
		expect(article.contentJson).toEqual({ type: 'doc', content: newBlocks })
		expect(result.id).toBe('new1')
	})

	test('falls back to the default title when the given title is blank', async () => {
		mockCreate.mockImplementation(async (article) => ({ ...article, id: 'new2' }))
		await createArticleWithBlocks('   ', newBlocks, authorizedFetch)
		expect(mockCreate.mock.calls[0][0].title).toBe('Untitled research')
	})
})

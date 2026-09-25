import { expect, test } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { createEmptyLocalArticle } from '../document'
import { appendBlocksToArticle, createArticleWithBlocks } from '../import/appendToArticle'

const http = installFixtureFetch()
const base = FEATURES_SERVER.replace(/\/$/, '')
const newBlocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'appended' }] }]
const authorizedFetch = (url: string, init?: RequestInit) => fetch(url, init)

function savedArticle() {
	const request = http.requests.find(({ init }) => init?.method === 'POST' || init?.method === 'PATCH')!
	return JSON.parse(request.init!.body as string)
}

test('appends after existing content and preserves editable article metadata', async () => {
	const intro = { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] }
	const existing = {
		...createEmptyLocalArticle(),
		id: 'a1',
		title: 'Weekly Alpha #3',
		slug: 'weekly-alpha-3',
		tags: ['dex'],
		section: 'report',
		contentJson: { type: 'doc', content: [intro] }
	}
	http.serve({
		[`${base}/articles/a1/edit`]: { article: existing },
		[`${base}/articles/a1`]: { article: { ...existing, contentJson: { type: 'doc', content: [intro, ...newBlocks] } } }
	})
	await appendBlocksToArticle('a1', newBlocks, authorizedFetch)
	expect(savedArticle()).toMatchObject({
		contentJson: { type: 'doc', content: [intro, ...newBlocks] },
		title: 'Weekly Alpha #3',
		slug: 'weekly-alpha-3',
		tags: ['dex'],
		section: 'report'
	})
})

test('appends to a draft with no content array', async () => {
	const existing = { ...createEmptyLocalArticle(), id: 'a2', contentJson: { type: 'doc' } }
	http.serve({ [`${base}/articles/a2/edit`]: { article: existing }, [`${base}/articles/a2`]: { article: existing } })
	await appendBlocksToArticle('a2', newBlocks, authorizedFetch)
	expect(savedArticle().contentJson).toEqual({ type: 'doc', content: newBlocks })
})

test.each([
	['Uniswap fee report', 'Uniswap fee report'],
	['   ', 'Untitled research']
])('creates a draft from imported blocks and title %j', async (title, expectedTitle) => {
	http.serve({ [`${base}/articles`]: { article: { ...createEmptyLocalArticle(), id: 'new1' } } })
	const result = await createArticleWithBlocks(title, newBlocks, authorizedFetch)
	expect(savedArticle()).toMatchObject({
		title: expectedTitle,
		status: 'draft',
		contentJson: { type: 'doc', content: newBlocks }
	})
	expect(result.id).toBe('new1')
})

// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RevisionHistoryDrawer } from '../editor/RevisionHistoryDrawer'
import type { ArticleRevision, ArticleRevisionEventType } from '../types'

// Newest first: a pending edit, the published (live) revision, an earlier draft save and the creation.
const EVENTS: Array<ArticleRevisionEventType> = ['pending_save', 'publish', 'save', 'create']
const revisions: Array<ArticleRevision> = EVENTS.map((eventType, i) => {
	const n = EVENTS.length - i
	return {
		id: `rev-${n}`,
		articleId: 'article-1',
		eventType,
		actorPbUserId: 'editor',
		actor: null,
		createdAt: `2026-09-0${n}T10:00:00Z`,
		snapshot: { title: `Revision ${n}`, plainText: `Paragraph ${n}`, slug: 'review', status: 'draft' }
	} as unknown as ArticleRevision
})

const getArticleRevision = vi.fn(async (_articleId: string, id: string) => revisions.find((r) => r.id === id)!)

vi.mock('~/containers/Articles/api', () => ({
	listArticleRevisions: async () => ({ items: revisions, nextCursor: null }),
	getArticleRevision: (...args: [string, string]) => getArticleRevision(...args),
	restoreArticleRevisionToPending: vi.fn(),
	deleteArticleRevision: vi.fn()
}))

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

async function flush() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

describe('RevisionHistoryDrawer diff base', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		getArticleRevision.mockClear()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	function button(text: string) {
		const match = Array.from(container.querySelectorAll('button')).find((el) => el.textContent?.trim() === text)
		if (!match) throw new Error(`No button "${text}"`)
		return match
	}

	async function click(el: Element) {
		await act(async () => {
			el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		})
		await flush()
	}

	function selectRevision(id: string) {
		return click(container.querySelector(`[data-revision-id="${id}"] button`)!)
	}

	function activeBase() {
		return container.querySelector('button[aria-pressed="true"]')?.textContent?.trim()
	}

	function paneText() {
		return container.textContent ?? ''
	}

	test('the chosen base is kept when the selected revision is that base, and the pane says why', async () => {
		await act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					<RevisionHistoryDrawer
						onClose={vi.fn()}
						articleId="article-1"
						authorizedFetch={vi.fn()}
						onRestored={vi.fn()}
					/>
				</QueryClientProvider>
			)
		})
		await flush()

		await click(button('diff'))
		await click(button('Live'))
		expect(activeBase()).toBe('Live')

		// The live revision cannot be compared with itself: Live stays chosen and the pane explains.
		await selectRevision('rev-3')
		expect(activeBase()).toBe('Live')
		expect(button('Live').disabled).toBe(true)
		expect(paneText()).toContain('This is the live revision')

		// The next selection is compared against Live again, as the user asked.
		await selectRevision('rev-2')
		expect(activeBase()).toBe('Live')
		expect(paneText()).toContain('base · Published')
	})

	test('the oldest revision explains that nothing earlier exists', async () => {
		await act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					<RevisionHistoryDrawer
						onClose={vi.fn()}
						articleId="article-1"
						authorizedFetch={vi.fn()}
						onRestored={vi.fn()}
					/>
				</QueryClientProvider>
			)
		})
		await flush()

		await click(button('diff'))
		await selectRevision('rev-1')
		expect(activeBase()).toBe('Previous')
		expect(paneText()).toContain('This is the oldest revision')
	})
})

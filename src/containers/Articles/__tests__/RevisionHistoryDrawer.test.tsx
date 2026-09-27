// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
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

const http = installFixtureFetch()
// The drawer receives authorizedFetch as a prop; plain fetch reaches the same fixtures.
const authorizedFetch = (url: string, init?: RequestInit) => fetch(url, init)
const revisionRequests = () =>
	http.requests.map((request) => request.url.pathname).filter((path) => /\/revisions\/rev-/.test(path))

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
		http.serve({
			'/articles/article-1/revisions': { items: revisions, nextCursor: null },
			// The rendered revision preview shows the article's promo placements.
			'/banners/lookup/all-articles': {}
		})
		for (const revision of revisions) http.serve({ [`/articles/article-1/revisions/${revision.id}`]: { revision } })
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	function button(text: string) {
		const match = Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.trim() === text)
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
		return click(document.querySelector(`[data-revision-id="${id}"] button`)!)
	}

	function activeBase() {
		return document.querySelector('button[aria-pressed="true"]')?.textContent?.trim()
	}

	function paneText() {
		return document.querySelector('[role="dialog"]')?.textContent ?? ''
	}

	test('the chosen base is kept when the selected revision is that base, and the pane says why', async () => {
		await act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					<RevisionHistoryDrawer
						onClose={vi.fn()}
						articleId="article-1"
						authorizedFetch={authorizedFetch}
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
						authorizedFetch={authorizedFetch}
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
	test('history owns focus and shortcuts; Escape cancels confirmation before closing', async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const onClose = vi.fn()
		function Harness() {
			const [open, setOpen] = useState(false)
			return (
				<QueryClientProvider client={client}>
					<button type="button" onClick={() => setOpen(true)}>
						History
					</button>
					{open && (
						<RevisionHistoryDrawer
							articleId="article-1"
							authorizedFetch={authorizedFetch}
							onRestored={vi.fn()}
							onClose={() => {
								onClose()
								setOpen(false)
							}}
						/>
					)}
				</QueryClientProvider>
			)
		}
		await act(async () => root.render(<Harness />))
		const trigger = button('History')
		await act(async () => {
			trigger.focus()
			trigger.click()
		})
		await flush()
		const drawer = document.querySelector<HTMLElement>('[role="dialog"]')!
		await waitForUi(() => expect(drawer.contains(document.activeElement)).toBe(true))
		expect(document.getElementById(drawer.getAttribute('aria-labelledby')!)!.textContent).toBe('Revision history')
		const press = async (target: HTMLElement, key: string) => {
			await act(async () =>
				target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
			)
			await flush()
		}
		await press(drawer, 'j')
		expect(revisionRequests().at(-1)).toBe('/articles/article-1/revisions/rev-3')
		await press(drawer, 'k')
		expect(drawer.textContent).toContain('Revision 4')
		await press(drawer, 'r')
		await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
		await press(button('Cancel'), 'Escape')
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
		expect(onClose).not.toHaveBeenCalled()
		await waitForUi(() => expect(document.activeElement?.textContent).toContain('Restore as pending'))
		await press(document.activeElement as HTMLElement, 'Escape')
		await waitForUi(() => expect(document.activeElement).toBe(trigger))
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		client.clear()
	})
})

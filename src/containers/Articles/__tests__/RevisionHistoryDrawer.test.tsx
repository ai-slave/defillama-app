// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
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
	async function renderDrawer() {
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
	}

	function dialogAlert() {
		return document.querySelector('[role="dialog"] [role="alert"]')?.textContent
	}

	test('a failed history load says so in the drawer instead of showing an empty ledger', async () => {
		http.serve({ '/articles/article-1/revisions': fixtureStatus(500, { error: 'History is unavailable' }) })
		await renderDrawer()
		await waitForUi(() => expect(dialogAlert()).toBe('History is unavailable'))
		expect(paneText()).not.toContain('No revisions yet')
	})

	test('a failed older-revisions page says so beside the button and keeps the loaded entries', async () => {
		http.serve({
			'/articles/article-1/revisions': (url: URL) =>
				url.searchParams.get('cursor')
					? fixtureStatus(500, { error: 'Older revisions are unavailable' })()
					: { items: revisions, nextCursor: 'page-2' }
		})
		await renderDrawer()
		await click(button('↓  Older revisions'))
		await waitForUi(() => expect(dialogAlert()).toBe('Older revisions are unavailable'))
		expect(document.querySelector('[data-revision-id="rev-4"]')).not.toBeNull()
	})

	test('a failed revision load says so in the preview pane instead of asking to pick an entry', async () => {
		http.serve({ '/articles/article-1/revisions/rev-4': fixtureStatus(404, { error: 'Revision not found' }) })
		await renderDrawer()
		await waitForUi(() => expect(dialogAlert()).toBe('Revision not found'))
		expect(paneText()).not.toContain('Pick an entry')
	})

	test('a failed diff base load says so instead of computing the diff forever', async () => {
		http.serve({ '/articles/article-1/revisions/rev-3': fixtureStatus(500, { error: 'Base revision is unavailable' }) })
		await renderDrawer()
		await click(button('diff'))
		await waitForUi(() => expect(dialogAlert()).toBe('Base revision is unavailable'))
		expect(paneText()).not.toContain('computing diff')
	})

	test('a failed restore says so in the drawer, and picking another revision clears it', async () => {
		http.serve({
			'/articles/article-1/revisions/rev-4/restore-pending': fixtureStatus(500, { error: 'Restore is unavailable' })
		})
		await renderDrawer()
		await waitForUi(() => expect(paneText()).toContain('Revision 4'))
		// The button also shows its R shortcut.
		await click(
			Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.startsWith('Restore as pending'))!
		)
		await click(button('Confirm restore'))
		await waitForUi(() => expect(dialogAlert()).toBe('Restore is unavailable'))
		await selectRevision('rev-2')
		expect(dialogAlert()).toBeUndefined()
	})

	test('picking a revision while a restore runs keeps that restore pending and sends no second one', async () => {
		http.serve({ '/articles/article-1/revisions/rev-4/restore-pending': () => new Promise<Response>(() => {}) })
		await renderDrawer()
		await waitForUi(() => expect(paneText()).toContain('Revision 4'))
		await click(
			Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.startsWith('Restore as pending'))!
		)
		await click(button('Confirm restore'))
		await selectRevision('rev-4')
		const restore = Array.from(document.querySelectorAll('button')).find((el) =>
			el.textContent?.startsWith('Restore as pending')
		)
		expect(restore?.disabled).toBe(true)
		expect(http.requests.filter((request) => request.url.pathname.endsWith('/restore-pending'))).toHaveLength(1)
	})

	async function confirmRestore() {
		await waitForUi(() => expect(paneText()).toContain('Revision 4'))
		await click(
			Array.from(document.querySelectorAll('button')).find((el) => el.textContent?.startsWith('Restore as pending'))!
		)
		await click(button('Confirm restore'))
	}

	async function renderDrawerWith(onClose: () => void, onRestored: () => void) {
		await act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					<RevisionHistoryDrawer
						onClose={onClose}
						articleId="article-1"
						authorizedFetch={authorizedFetch}
						onRestored={onRestored}
					/>
				</QueryClientProvider>
			)
		})
		await flush()
	}

	test('the drawer cannot be closed while a restore runs', async () => {
		http.serve({ '/articles/article-1/revisions/rev-4/restore-pending': () => new Promise<Response>(() => {}) })
		const onClose = vi.fn()
		await renderDrawerWith(onClose, vi.fn())
		await confirmRestore()

		await click(document.querySelector('button[aria-label="Close"]')!)
		await act(async () => {
			document
				.querySelector('[role="dialog"]')!
				.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		})
		await flush()
		expect(onClose).not.toHaveBeenCalled()
	})

	test('a restore that settles after the drawer is gone does not replace the editor or close a later drawer', async () => {
		let answer!: (response: Response) => void
		http.serve({
			'/articles/article-1/revisions/rev-4/restore-pending': () =>
				new Promise<Response>((resolve) => (answer = resolve))
		})
		const onClose = vi.fn()
		const onRestored = vi.fn()
		await renderDrawerWith(onClose, onRestored)
		await confirmRestore()

		// The reader leaves the article while the restore is still out.
		await act(async () => root.render(null))
		await act(async () => answer(Response.json({ article: { id: 'article-1', title: 'Restored' } })))
		await flush()
		expect(onRestored).not.toHaveBeenCalled()
		expect(onClose).not.toHaveBeenCalled()
	})

	test('a failed delete says so in the drawer and keeps the revision listed', async () => {
		const revision = revisions.find((entry) => entry.id === 'rev-2')!
		http.serve({
			'/articles/article-1/revisions/rev-2': (_url: URL, init?: RequestInit) =>
				init?.method === 'DELETE' ? fixtureStatus(500, { error: 'Delete is unavailable' })() : { revision }
		})
		await renderDrawer()
		await selectRevision('rev-2')
		await waitForUi(() => expect(paneText()).toContain('Revision 2'))
		await click(document.querySelector('button[aria-label="Delete revision"]')!)
		await click(button('Confirm delete'))
		await waitForUi(() => expect(dialogAlert()).toBe('Delete is unavailable'))
		expect(document.querySelector('[data-revision-id="rev-2"]')).not.toBeNull()
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

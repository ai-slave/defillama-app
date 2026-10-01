// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
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

describe('RevisionHistoryDrawer', () => {
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

	function button(name: string, scope: ParentNode = document) {
		const match = Array.from(scope.querySelectorAll('button')).find((el) => accessibleName(el) === name)
		if (!match) throw new Error(`No button "${name}"`)
		return match
	}

	function radio(group: string, value: string) {
		return document.querySelector<HTMLInputElement>(
			`[role="radiogroup"][aria-label="${group}"] input[value="${value}"]`
		)!
	}

	function chosen(group: string) {
		return document
			.querySelector(`[role="radiogroup"][aria-label="${group}"] input:checked`)
			?.closest('label')
			?.textContent?.trim()
	}

	async function click(el: Element) {
		await act(async () => {
			el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		})
		await flush()
	}

	async function pick(group: string, value: string) {
		await act(async () => radio(group, value).click())
		await flush()
	}

	function selectRevision(id: string) {
		return click(document.querySelector(`[data-revision-id="${id}"] button`)!)
	}

	function sheet() {
		return document.querySelector<HTMLElement>('[role="dialog"]')!
	}

	function sheetText() {
		return sheet()?.textContent ?? ''
	}

	function sheetAlert() {
		return sheet()?.querySelector('[role="alert"]')?.textContent
	}

	function confirmation(title: string) {
		return Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).find(
			(dialog) => dialog.querySelector('h2')?.textContent === title
		)
	}

	async function renderDrawer(onClose: () => void = vi.fn(), onRestored: () => void = vi.fn()) {
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

	async function askRestore() {
		await waitForUi(() => expect(sheetText()).toContain('Revision 4'))
		await click(button('Restore as pending'))
	}

	test('a base with nothing to compare stays pickable and the pane says why', async () => {
		await renderDrawer()
		await pick('View', 'diff')
		await selectRevision('rev-3')

		// The live revision cannot be compared with itself: Live is still chosen and the pane explains.
		await pick('Compare against', 'live')
		expect(chosen('Compare against')).toBe('Live')
		expect(sheetText()).toContain('This is the live revision')

		// The next selection is compared against Live, as the user asked.
		await selectRevision('rev-2')
		expect(chosen('Compare against')).toBe('Live')
		await waitForUi(() => expect(sheetText()).toContain('Base: Published'))
	})

	test('the oldest revision explains that nothing earlier exists', async () => {
		await renderDrawer()
		await pick('View', 'diff')
		await selectRevision('rev-1')
		expect(chosen('Compare against')).toBe('Previous')
		expect(sheetText()).toContain('This is the oldest revision')
	})

	test('a failed history load says so in the drawer instead of showing an empty history', async () => {
		http.serve({ '/articles/article-1/revisions': fixtureStatus(500, { error: 'History is unavailable' }) })
		await renderDrawer()
		await waitForUi(() => expect(sheetAlert()).toContain("Couldn't load the revision history."))
		expect(sheetText()).not.toContain('History is unavailable')
		expect(sheetText()).not.toContain('No revisions yet')
	})

	test('Try again reloads a history that failed to load', async () => {
		http.serve({ '/articles/article-1/revisions': fixtureStatus(500, { error: 'History is unavailable' }) })
		await renderDrawer()
		await waitForUi(() => expect(sheetAlert()).toBeDefined())

		http.serve({ '/articles/article-1/revisions': { items: revisions, nextCursor: null } })
		await click(button('Try again'))
		await waitForUi(() => expect(document.querySelector('[data-revision-id="rev-4"]')).not.toBeNull())
		expect(sheetAlert()).toBeUndefined()
	})

	test('a failed older-revisions page says so beside the button and keeps the loaded entries', async () => {
		http.serve({
			'/articles/article-1/revisions': (url: URL) =>
				url.searchParams.get('cursor')
					? fixtureStatus(500, { error: 'Older revisions are unavailable' })()
					: { items: revisions, nextCursor: 'page-2' }
		})
		await renderDrawer()
		await waitForUi(() => expect(sheetText()).toContain('4+ entries'))
		await click(button('Load older revisions'))
		await waitForUi(() => expect(sheetAlert()).toBe("Couldn't load older revisions. Try again."))
		expect(document.querySelector('[data-revision-id="rev-4"]')).not.toBeNull()
	})

	test('a failed revision load says so in the preview pane instead of showing no selection', async () => {
		http.serve({ '/articles/article-1/revisions/rev-4': fixtureStatus(404, { error: 'Revision not found' }) })
		await renderDrawer()
		await waitForUi(() => expect(sheetAlert()).toContain("Couldn't load this revision."))
		expect(sheetText()).not.toContain('No revision selected')
	})

	test('a failed diff base load says so instead of loading the comparison forever', async () => {
		http.serve({ '/articles/article-1/revisions/rev-3': fixtureStatus(500, { error: 'Base revision is unavailable' }) })
		await renderDrawer()
		await pick('View', 'diff')
		await waitForUi(() => expect(sheetAlert()).toContain("Couldn't load the revision to compare against."))
		expect(sheetText()).not.toContain('Loading comparison')
	})

	test('a failed restore says so in its confirmation, which stays open, and a new attempt starts clean', async () => {
		http.serve({
			'/articles/article-1/revisions/rev-4/restore-pending': fixtureStatus(500, { error: 'Restore is unavailable' })
		})
		await renderDrawer()
		await askRestore()
		await click(button('Restore'))
		const confirm = () => confirmation('Restore as pending?')
		await waitForUi(() =>
			expect(confirm()?.querySelector('[role="alert"]')?.textContent).toBe("Couldn't restore this revision. Try again.")
		)

		await click(button('Cancel'))
		await waitForUi(() => expect(confirm()).toBeUndefined())
		await click(button('Restore as pending'))
		await waitForUi(() => expect(confirm()).toBeDefined())
		expect(confirm()!.querySelector('[role="alert"]')).toBeNull()
	})

	test('a running restore shows Restoring… and nothing closes the drawer or its confirmation', async () => {
		http.serve({ '/articles/article-1/revisions/rev-4/restore-pending': () => new Promise<Response>(() => {}) })
		const onClose = vi.fn()
		await renderDrawer(onClose)
		await askRestore()
		await click(button('Restore'))
		expect(confirmation('Restore as pending?')?.textContent).toContain('Restoring…')

		await click(button('Close dialog'))
		await act(async () => {
			document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		})
		await flush()
		expect(onClose).not.toHaveBeenCalled()
		expect(confirmation('Restore as pending?')).toBeDefined()
		expect(http.requests.filter((request) => request.url.pathname.endsWith('/restore-pending'))).toHaveLength(1)
	})

	test('a restore that settles after the drawer is gone does not replace the editor or close a later drawer', async () => {
		let answer!: (response: Response) => void
		http.serve({
			'/articles/article-1/revisions/rev-4/restore-pending': () =>
				new Promise<Response>((resolve) => (answer = resolve))
		})
		const onClose = vi.fn()
		const onRestored = vi.fn()
		await renderDrawer(onClose, onRestored)
		await askRestore()
		await click(button('Restore'))

		// The reader leaves the article while the restore is still out.
		await act(async () => root.render(null))
		await act(async () => answer(Response.json({ article: { id: 'article-1', title: 'Restored' } })))
		await flush()
		expect(onRestored).not.toHaveBeenCalled()
		expect(onClose).not.toHaveBeenCalled()
	})

	test('a failed delete says so in its confirmation and keeps the revision listed', async () => {
		const revision = revisions.find((entry) => entry.id === 'rev-2')!
		http.serve({
			'/articles/article-1/revisions/rev-2': (_url: URL, init?: RequestInit) =>
				init?.method === 'DELETE' ? fixtureStatus(500, { error: 'Delete is unavailable' })() : { revision }
		})
		await renderDrawer()
		await selectRevision('rev-2')
		await waitForUi(() => expect(sheetText()).toContain('Revision 2'))
		await click(button('Delete'))
		await waitForUi(() => expect(confirmation('Delete this revision?')).toBeDefined())
		await click(button('Delete', confirmation('Delete this revision?')!))
		await waitForUi(() =>
			expect(confirmation('Delete this revision?')?.querySelector('[role="alert"]')?.textContent).toBe(
				"Couldn't delete this revision. Try again."
			)
		)
		expect(document.querySelector('[data-revision-id="rev-2"]')).not.toBeNull()
	})

	test('a deleted revision leaves the list and the newest revision is shown', async () => {
		const revision = revisions.find((entry) => entry.id === 'rev-2')!
		http.serve({
			'/articles/article-1/revisions/rev-2': (_url: URL, init?: RequestInit) =>
				init?.method === 'DELETE' ? new Response(null, { status: 204 }) : { revision }
		})
		await renderDrawer()
		await selectRevision('rev-2')
		await waitForUi(() => expect(sheetText()).toContain('Revision 2'))
		await click(button('Delete'))
		await waitForUi(() => expect(confirmation('Delete this revision?')).toBeDefined())
		await click(button('Delete', confirmation('Delete this revision?')!))
		await waitForUi(() => expect(document.querySelector('[data-revision-id="rev-2"]')).toBeNull())
		expect(confirmation('Delete this revision?')).toBeUndefined()
		expect(sheetText()).toContain('3 entries')
		expect(document.querySelector('[data-revision-id="rev-4"] button')!.getAttribute('aria-current')).toBe('true')
	})

	test('the live revision says why it cannot be deleted', async () => {
		await renderDrawer()
		await selectRevision('rev-3')
		await waitForUi(() => expect(sheetText()).toContain('Revision 3'))
		expect(sheetText()).toContain("The live revision can't be deleted.")
		expect(button('Delete').getAttribute('aria-disabled')).toBe('true')

		await selectRevision('rev-2')
		expect(sheetText()).not.toContain("The live revision can't be deleted.")
	})

	test('moving the selection with the keyboard scrolls the newly selected revision into view', async () => {
		// happy-dom has no layout, so record which row asked to be scrolled.
		const scrolled: Array<string | null> = []
		const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (
			this: HTMLElement
		) {
			scrolled.push(this.getAttribute('data-revision-id'))
		})
		await renderDrawer()
		await waitForUi(() => expect(sheetText()).toContain('Revision 4'))
		scrolled.length = 0
		await act(async () =>
			sheet().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
		)
		await flush()
		expect(scrolled).toEqual(['rev-3'])
		scrollIntoView.mockRestore()
	})

	test('history owns focus and shortcuts; Escape closes the confirmation before the drawer', async () => {
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
		const drawer = sheet()
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
		await waitForUi(() => expect(drawer.textContent).toContain('Revision 4'))
		await press(drawer, 'r')
		await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
		await press(button('Cancel'), 'Escape')
		await waitForUi(() => expect(confirmation('Restore as pending?')).toBeUndefined())
		expect(onClose).not.toHaveBeenCalled()
		await waitForUi(() => expect(document.activeElement).toBe(button('Restore as pending')))
		await press(document.activeElement as HTMLElement, 'Escape')
		await waitForUi(() => expect(document.activeElement).toBe(trigger))
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		client.clear()
	})
})

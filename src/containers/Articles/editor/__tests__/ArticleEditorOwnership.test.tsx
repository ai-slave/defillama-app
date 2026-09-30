// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { createEmptyLocalArticle } from '../../document'
import type { ArticleDocument, ArticleRevision, LocalArticleDocument } from '../../types'
import { ArticleEditorClient } from '../ArticleEditorClient'

const router = vi.hoisted(() => ({
	query: {},
	asPath: '/research/edit/article-a',
	replace: vi.fn(),
	events: { on: vi.fn(), off: vi.fn() }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
const session = installSubscriberSession('article-editor')

function stored(id: string, title: string): ArticleDocument {
	return {
		...createEmptyLocalArticle(),
		id,
		title,
		slug: id,
		viewerRole: 'owner',
		section: 'spotlight',
		tags: ['defi'],
		displayDate: '2026-09-06T00:00:00Z',
		authorProfile: { slug: 'author', displayName: 'Author', socials: {}, createdAt: '', updatedAt: '' }
	} as ArticleDocument
}

function revision(articleId: string): ArticleRevision {
	return {
		id: 'rev-1',
		articleId,
		eventType: 'save',
		actorPbUserId: 'editor',
		actor: null,
		createdAt: '2026-09-06T10:00:00Z',
		snapshot: { title: 'Restored headline', plainText: '', slug: articleId, status: 'draft' }
	} as unknown as ArticleRevision
}

let articles: Record<string, ArticleDocument>
let saves: Array<{ id: string; title: string }>
/** Answers a save of this article when the test says so; other saves answer at once. */
let heldSave: { id: string; answer: () => void } | null
/** Answers the restore when the test says so; left null, it answers at once. */
let heldRestore: { answer: () => void } | null
/** Holds the next read of an article with the copy it had when the read arrived. */
let heldRead: { answer: () => void } | null
let root: Root
let container: HTMLDivElement

beforeEach(() => {
	articles = { 'article-a': stored('article-a', 'Headline A'), 'article-b': stored('article-b', 'Headline B') }
	saves = []
	heldSave = null
	heldRestore = null
	heldRead = null
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${FEATURES_SERVER}/articles/`]: async (url: URL, init?: RequestInit) => {
			const id = decodeURIComponent(url.pathname.split('/')[2])
			if (url.pathname.endsWith('/edit')) {
				const copy = articles[id]
				if (heldRead) await new Promise<void>((resolve) => (heldRead!.answer = resolve))
				return { article: copy }
			}
			if (url.pathname.endsWith('/collaborators')) return { collaborators: [] }
			if (url.pathname.endsWith('/revisions')) return { items: [revision(id)], nextCursor: null }
			if (url.pathname.endsWith('/restore-pending')) {
				if (heldRestore) await new Promise<void>((resolve) => (heldRestore!.answer = resolve))
				articles[id] = { ...articles[id], pending: { title: 'Restored headline' } as ArticleDocument['pending'] }
				return { article: articles[id] }
			}
			if (url.pathname.includes('/revisions/')) return { revision: revision(id) }
			const payload = JSON.parse(init!.body as string) as LocalArticleDocument
			saves.push({ id, title: payload.title })
			const saved = { ...articles[id], ...payload, id, updatedAt: new Date().toISOString() }
			if (heldSave?.id === id) await new Promise<void>((resolve) => (heldSave!.answer = resolve))
			articles[id] = saved
			return { article: saved }
		},
		// The revision preview shows the article's promo placements.
		[`${FEATURES_SERVER}/banners/lookup/all-articles`]: {}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function settle() {
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function open(articleId: string) {
	router.asPath = `/research/edit/${articleId}`
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AppMetadataProvider>
					<ArticleEditorClient articleId={articleId} />
				</AppMetadataProvider>
			</session.Wrapper>
		)
	)
	await settle()
	await settle()
}

const title = () => container.querySelector<HTMLTextAreaElement>('[aria-label="Article title"]')!

async function typeTitle(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(title(), value)
		title().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function save() {
	await act(async () =>
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
	)
	await settle()
}

test("a save of one article that settles after moving to another leaves the second article's editor alone", async () => {
	await open('article-a')
	heldSave = { id: 'article-a', answer: () => {} }
	await typeTitle('Headline A, edited')
	await save()
	expect(saves).toEqual([{ id: 'article-a', title: 'Headline A, edited' }])

	// The reader confirms leaving while the save is out and opens another article in the same editor route.
	await open('article-b')
	expect(title().value).toBe('Headline B')
	await act(async () => heldSave!.answer())
	await settle()
	expect(title().value).toBe('Headline B')

	await typeTitle('Headline B, edited')
	await save()
	expect(saves.at(-1)).toEqual({ id: 'article-b', title: 'Headline B, edited' })
})

const historyDrawer = () =>
	[...document.querySelectorAll('[role="dialog"]')].find((dialog) => dialog.textContent?.includes('Revision history'))

function button(text: string) {
	return [...document.querySelectorAll('button')].find((el) => el.textContent?.trim().startsWith(text))!
}

async function click(el: Element) {
	await act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	await settle()
}

async function restoreFromHistory() {
	await click(container.querySelector('button[title="Revision history"]')!)
	await settle()
	await click(button('Restore as pending'))
	// The confirmation's own button, not the drawer's "Restore as pending".
	await click([...document.querySelectorAll('button')].find((el) => accessibleName(el) === 'Restore')!)
}

test('a successful restore puts the revision in the editor and closes history', async () => {
	await open('article-a')
	await restoreFromHistory()
	await settle()

	expect(title().value).toBe('Restored headline')
	expect(historyDrawer()).toBeUndefined()
})

test('a restore that settles after moving to another article shows when the reader comes back', async () => {
	await open('article-a')
	heldRestore = { answer: () => {} }
	await restoreFromHistory()

	await open('article-b')
	await act(async () => heldRestore!.answer())
	await settle()
	expect(title().value).toBe('Headline B')

	await open('article-a')
	expect(title().value).toBe('Restored headline')
})

test('coming back to an article while its restore runs waits for the restore, then opens the restored version', async () => {
	await open('article-a')
	heldRestore = { answer: () => {} }
	await restoreFromHistory()

	await open('article-b')
	await open('article-a')
	expect(title()).toBeNull()

	await act(async () => heldRestore!.answer())
	await settle()
	await settle()
	expect(title().value).toBe('Restored headline')
})

test('coming back to an article while its save runs opens the saved version, not the copy from before it', async () => {
	await open('article-a')
	heldSave = { id: 'article-a', answer: () => {} }
	await typeTitle('Headline A, edited')
	await save()
	// A save of the open editor keeps it open for typing.
	expect(title().value).toBe('Headline A, edited')

	await open('article-b')
	await open('article-a')
	expect(title()).toBeNull()

	await act(async () => heldSave!.answer())
	await settle()
	await settle()
	expect(title().value).toBe('Headline A, edited')
})

test('a read answered before a restore but arriving after it does not bring the older copy back on a later visit', async () => {
	await open('article-a')
	heldRestore = { answer: () => {} }
	await restoreFromHistory()

	await open('article-b')
	heldRead = { answer: () => {} }
	await open('article-a')
	await act(async () => heldRestore!.answer())
	await settle()
	await act(async () => heldRead!.answer())
	await settle()
	expect(title().value).toBe('Restored headline')

	await open('article-b')
	await open('article-a')
	expect(title().value).toBe('Restored headline')
})

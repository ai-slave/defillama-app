// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { createEmptyLocalArticle } from '../../document'
import type { ArticleDocument, LocalArticleDocument } from '../../types'
import { ArticleEditorClient } from '../ArticleEditorClient'

const api = vi.hoisted(() => ({ save: vi.fn(), publish: vi.fn(), error: vi.fn(), upload: vi.fn() }))
const router = {
	query: {},
	asPath: '/research/edit/test-article',
	replace: vi.fn(),
	events: { on: vi.fn(), off: vi.fn() }
}
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('react-hot-toast', () => ({
	default: { error: api.error, success: vi.fn(), promise: (pending: Promise<unknown>) => pending }
}))
const session = installSubscriberSession('article-editor')

let article: ArticleDocument
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.resetAllMocks()
	article = {
		...createEmptyLocalArticle(),
		id: 'test-article',
		title: 'Saved headline',
		slug: 'test-article',
		viewerRole: 'owner',
		section: 'spotlight',
		tags: ['defi'],
		displayDate: '2026-09-06T00:00:00Z',
		coverImage: { url: '/cover.png', caption: 'Cover', copyright: 'Author', credit: 'Author' },
		authorProfile: { slug: 'author', displayName: 'Author', socials: {}, createdAt: '', updatedAt: '' }
	}
	api.save.mockImplementation(async (_url: URL, init: RequestInit) => {
		const payload = JSON.parse(init.body as string) as LocalArticleDocument
		article = { ...article, ...payload, updatedAt: new Date().toISOString() }
		return article
	})
	api.publish.mockImplementation(async () => {
		article = { ...article, status: 'published' }
		return article
	})
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${FEATURES_SERVER}/articles/`]: async (url: URL, init?: RequestInit) => {
			if (url.pathname.endsWith('/edit')) return { article }
			if (url.pathname.endsWith('/collaborators')) return { collaborators: [] }
			return { article: await api.save(url, init) }
		},
		'http://localhost:3000/api/private/research/articles/': async (url: URL, init?: RequestInit) => ({
			article: await api.publish(url, init)
		}),
		'/api/private/research/revalidate-landing': {},
		'/uploads/image': (url: URL, init?: RequestInit) => api.upload(url, init)
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
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}
async function mount(articleId = 'test-article') {
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
function button(name: string) {
	const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(x) => x.textContent?.trim().replace(/\s*[→▾]$/, '') === name || x.getAttribute('aria-label') === name
	)
	if (!result) throw new Error(`Missing button: ${name}`)
	return result
}
async function click(name: string) {
	await act(async () => button(name).click())
	await settle()
}
function title() {
	return container.querySelector<HTMLTextAreaElement>('[aria-label="Article title"]')!
}
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
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

test('keeps unsaved edits and the review open when saving fails, then publishes the retry', async () => {
	await mount()
	await typeTitle('Latest headline')
	api.save.mockRejectedValueOnce(new Error('Save unavailable'))
	await click('Publish')
	await click('Publish now')
	expect(api.publish).not.toHaveBeenCalled()
	expect(title().value).toBe('Latest headline')
	expect(button('Keep editing')).toBeTruthy()
	await click('Publish now')
	expect(api.publish).toHaveBeenCalledOnce()
	expect(article.title).toBe('Latest headline')
	expect(button('Live')).toBeTruthy()
})

test('keeps the saved draft and review available after a publish failure', async () => {
	await mount()
	await typeTitle('Draft survives publish failure')
	api.publish.mockRejectedValueOnce(new Error('Publish unavailable'))
	await click('Publish')
	await click('Publish now')
	expect(article.title).toBe('Draft survives publish failure')
	expect(article.status).toBe('draft')
	expect(title().value).toBe('Draft survives publish failure')
	expect(button('Publish now').closest<HTMLElement>('[role="dialog"]')!.hidden).toBe(false)
	expect(button('Publish now').disabled).toBe(false)
	await click('Publish now')
	expect(api.publish).toHaveBeenCalledTimes(2)
	expect(api.save).toHaveBeenCalledOnce()
	expect(button('Live')).toBeTruthy()
})

test('does not overwrite newer typing or start overlapping saves while a request is pending', async () => {
	await mount()
	const pending = deferred<ArticleDocument>()
	api.save.mockReturnValueOnce(pending.promise)
	await typeTitle('In-flight headline')
	await save()
	const savedPayload = JSON.parse(api.save.mock.calls[0][1].body as string) as LocalArticleDocument
	await typeTitle('Newer headline')
	await save()
	expect(api.save).toHaveBeenCalledOnce()
	await act(async () => pending.resolve({ ...article, ...savedPayload }))
	await settle()
	expect(title().value).toBe('Newer headline')
	expect(button('Save now')).toBeTruthy()
	await save()
	expect(article.title).toBe('Newer headline')
})

test('blocks duplicate publish actions until the response resolves', async () => {
	await mount()
	const pending = deferred<ArticleDocument>()
	api.publish.mockReturnValueOnce(pending.promise)
	await click('Publish')
	await click('Publish now')
	expect(button('Publishing…').disabled).toBe(true)
	await click('Publishing…')
	expect(api.publish).toHaveBeenCalledOnce()
	await act(async () => pending.resolve({ ...article, status: 'published' }))
	await settle()
	expect(button('Live')).toBeTruthy()
})

test('validates required fields before issuing a publish request', async () => {
	await mount()
	await typeTitle('')
	await click('Publish')
	await click('Publish now')
	expect(api.publish).not.toHaveBeenCalled()
	expect(api.error).toHaveBeenCalledWith('Fix required fields before publishing')
	expect(button('Keep editing')).toBeTruthy()
})

test('retains the listing dialog when its save fails', async () => {
	article.status = 'published'
	await mount()
	api.save.mockRejectedValueOnce(new Error('Save unavailable'))
	await click('Live')
	await act(async () =>
		[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
			.find((x) => x.textContent?.includes('Edit listing'))!
			.click()
	)
	await settle()
	await click('Save changes')
	const review = button('Save changes').closest<HTMLElement>('[role="dialog"]')!
	expect(review.hidden).toBe(false)
	expect(button('Save changes').disabled).toBe(false)
	expect(api.error).toHaveBeenCalledWith('Save unavailable')
	await click('Save changes')
	expect(review.hidden).toBe(true)
})

test('saves the committed slug rather than the previous render’s slug', async () => {
	await mount()
	await act(async () => container.querySelector<HTMLButtonElement>('button[title="Click to edit slug"]')!.click())
	const input = container.querySelector<HTMLInputElement>('nav input')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'new-slug')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () =>
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
	)
	await save()
	expect(article.slug).toBe('new-slug')
	expect(api.save).toHaveBeenCalledOnce()
})

test('preserves cover metadata edited while its replacement uploads', async () => {
	const pending = deferred<{ url: string }>()
	api.upload.mockReturnValue(pending.promise)
	await mount()
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('[aria-label="Upload cover image"]')!
		Object.defineProperty(input, 'files', {
			configurable: true,
			value: [new File(['image'], 'cover.png', { type: 'image/png' })]
		})
		// The DOM shim does not populate value when files are assigned. Model the browser's chosen filename.
		Object.defineProperty(input, 'value', { configurable: true, writable: true, value: 'C:\\fakepath\\cover.png' })
		input.dispatchEvent(new Event('change', { bubbles: true }))
	})
	await click('Edit details')
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('[placeholder="Photographer"]')!
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Updated photographer')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await click('Done')
	await act(async () => pending.resolve({ url: '/replacement.png' }))
	await save()
	expect(JSON.parse(api.save.mock.calls.at(-1)![1].body as string).coverImage).toMatchObject({
		url: '/replacement.png',
		credit: 'Updated photographer'
	})
})

test('does not apply an old cover upload to a different article', async () => {
	const pending = deferred<{ url: string }>()
	api.upload.mockReturnValue(pending.promise)
	await mount()
	await act(async () => {
		const input = document.querySelector<HTMLInputElement>('[aria-label="Upload cover image"]')!
		Object.defineProperty(input, 'files', {
			configurable: true,
			value: [new File(['image'], 'cover.png', { type: 'image/png' })]
		})
		// The DOM shim does not populate value when files are assigned. Model the browser's chosen filename.
		Object.defineProperty(input, 'value', { configurable: true, writable: true, value: 'C:\\fakepath\\cover.png' })
		input.dispatchEvent(new Event('change', { bubbles: true }))
	})
	article = {
		...article,
		id: 'second-article',
		title: 'Another article',
		coverImage: { url: '/second.png', alt: 'Second cover' }
	}
	await mount('second-article')
	await act(async () => pending.resolve({ url: '/late.png' }))
	expect(title().value).toBe('Another article')
	expect(container.querySelector('img[alt="Second cover"]')?.getAttribute('src')).toBe('/second.png')
	const input = document.querySelector<HTMLInputElement>('[aria-label="Upload cover image"]')!
	expect(input.value).toBe('')
	api.upload.mockResolvedValue({ url: '/retry.png' })
	Object.defineProperty(input, 'files', {
		configurable: true,
		value: [new File(['image'], 'cover.png', { type: 'image/png' })]
	})
	await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
	expect(api.upload).toHaveBeenCalledTimes(2)
	await save()
	expect(JSON.parse(api.save.mock.calls.at(-1)![1].body as string).coverImage.url).toBe('/retry.png')
})

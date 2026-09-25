// @vitest-environment happy-dom

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { ReportHighlightControls } from '../admin/EditorialTagsView'
import { ReportRow } from '../admin/ReportsAdminView'
import type { ArticleDocument } from '../types'

// Heavy children the assertions never look at.
vi.mock('~/containers/Articles/upload/PdfUploadButton', () => ({ PdfUploadButton: () => null }))
vi.mock('~/containers/Articles/admin/ArticlePicker', () => ({ ArticlePicker: () => null }))
vi.mock('~/containers/Articles/admin/EditorialTagRow', () => ({ EditorialTagRow: () => null }))
vi.mock('~/containers/Articles/admin/ReorderableEditorialTagList', () => ({ ReorderableEditorialTagList: () => null }))

const session = installSubscriberSession('editor-1')

const article = {
	id: 'article-1',
	title: 'Quarterly report',
	slug: 'quarterly-report',
	status: 'draft',
	pending: null,
	reportDescription: 'A',
	reportPdf: null,
	carouselImage: null,
	sponsorLogo: null,
	editorialTagMetadata: { highlightText: 'Saved highlight' }
} as unknown as ArticleDocument
const savedLogo = { url: '/uploads/saved-logo.png', width: 64, height: 64 }

// Each PATCH takes the next queued answer; a function sees the request body. Rejections model a lost connection.
type Answer = Promise<unknown> | ((body: any) => unknown)
const patches: Record<'report' | 'logo' | 'metadata', Array<Answer>> = { report: [], logo: [], metadata: [] }
const reportBodies: Array<unknown> = []

function answer(kind: keyof typeof patches, init: RequestInit | undefined) {
	const body = JSON.parse(String(init?.body))
	if (kind === 'report') reportBodies.push(body)
	const next = patches[kind].shift()
	if (!next) throw new Error(`No queued ${kind} answer`)
	return typeof next === 'function' ? next(body) : next
}

function deferred<T>() {
	return Promise.withResolvers<T>()
}

let uploads = 0

describe('admin drafts around saves', () => {
	let container: HTMLDivElement
	let root: Root

	function render(element: ReactElement) {
		return act(async () => root.render(<session.Wrapper>{element}</session.Wrapper>))
	}

	function textarea() {
		return container.querySelector('textarea')!
	}

	function logo() {
		return container.querySelector('img')?.getAttribute('src') ?? null
	}

	function button(text: string) {
		const el = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
		if (!el) throw new Error(`No button "${text}"`)
		return el
	}

	function type(value: string) {
		const el = textarea()
		return act(async () => {
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value)
			el.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

	function click(text: string) {
		return act(async () => button(text).dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	function chooseLogoFile() {
		const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
		Object.defineProperty(input, 'files', {
			configurable: true,
			value: [new File(['image'], 'logo.png', { type: 'image/png' })]
		})
		return act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		patches.report = []
		patches.logo = []
		patches.metadata = []
		reportBodies.length = 0
		uploads = 0
		session.client.setDefaultOptions({ queries: { retry: false } })
		session.serve({
			'/articles/article-1': async (_url, init) => ({ article: await answer('report', init) }),
			'/articles/article-1/report-highlight/sponsor-logo': async (_url, init) => ({
				article: await answer('logo', init)
			}),
			[`${FEATURES_SERVER}/articles/article-1/editorial-tags/`]: async (_url, init) => answer('metadata', init),
			'/api/private/research/revalidate-landing': {},
			'/uploads/image': () => ({ id: `u${++uploads}`, url: `/uploads/logo-${uploads}.png`, width: 64, height: 64 })
		})
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('report row: text typed while a save is in flight survives the save completing', async () => {
		const save = deferred<ArticleDocument>()
		patches.report.push(save.promise)
		await render(<ReportRow article={article} />)

		await type('B')
		await click('Save')
		await vi.waitFor(() => expect(reportBodies).toMatchObject([{ reportDescription: 'B' }]), { timeout: 500 })

		await type('C')
		await act(async () => save.resolve({ ...article, reportDescription: 'B' }))

		await vi.waitFor(() => expect(button('Save').disabled).toBe(false), { timeout: 500 })
		expect(textarea().value).toBe('C')
		expect(container.textContent).not.toContain('changed elsewhere')
	})

	test('report row: a save with no edits in flight ends clean with the stored value', async () => {
		patches.report.push(() => ({ ...article, reportDescription: 'B' }))
		await render(<ReportRow article={article} />)

		await type('  B  ')
		await click('Save')

		await vi.waitFor(() => expect(textarea().value).toBe('B'), { timeout: 500 })
		expect(button('Save').disabled).toBe(true)
	})

	test('highlight controls: uploading a sponsor logo keeps unsaved highlight text', async () => {
		patches.logo.push(({ sponsorLogo }) => ({ ...article, sponsorLogo }))
		await render(<ReportHighlightControls article={article} pending={false} invalidate={vi.fn()} />)

		await type('Draft highlight')
		await chooseLogoFile()

		await vi.waitFor(() => expect(logo()).toBe('/uploads/logo-1.png'), { timeout: 500 })
		expect(textarea().value).toBe('Draft highlight')
		expect(container.textContent).not.toContain('changed elsewhere')
	})

	test('highlight controls: a rejected logo removal puts the saved logo back and keeps the text draft', async () => {
		const removal = deferred<never>()
		patches.logo.push(removal.promise)
		await render(
			<ReportHighlightControls article={{ ...article, sponsorLogo: savedLogo }} pending={false} invalidate={vi.fn()} />
		)

		await type('Draft highlight')
		await click('Remove')
		// Optimistic: the logo is gone while the request runs.
		expect(logo()).toBeNull()

		await act(async () => removal.reject(new Error('offline')))
		await vi.waitFor(() => expect(logo()).toBe('/uploads/saved-logo.png'), { timeout: 500 })
		expect(textarea().value).toBe('Draft highlight')
	})

	test('highlight controls: a rejected replacement does not undo a newer upload that succeeded', async () => {
		const failing = deferred<never>()
		patches.logo.push(failing.promise, ({ sponsorLogo }) => ({ ...article, sponsorLogo }))
		await render(<ReportHighlightControls article={article} pending={false} invalidate={vi.fn()} />)

		await chooseLogoFile()
		await vi.waitFor(() => expect(logo()).toBe('/uploads/logo-1.png'), { timeout: 500 })
		await chooseLogoFile()
		await vi.waitFor(() => expect(logo()).toBe('/uploads/logo-2.png'), { timeout: 500 })

		await act(async () => failing.reject(new Error('offline')))
		await vi.waitFor(() => expect(patches.logo).toEqual([]), { timeout: 500 })
		expect(logo()).toBe('/uploads/logo-2.png')
	})

	test('highlight controls: saving the text keeps the logo and ends clean', async () => {
		patches.metadata.push(() => ({ metadata: { highlightText: 'New highlight' } }))
		await render(
			<ReportHighlightControls article={{ ...article, sponsorLogo: savedLogo }} pending={false} invalidate={vi.fn()} />
		)

		await type('  New highlight  ')
		await click('Save highlight text')

		await vi.waitFor(() => expect(textarea().value).toBe('New highlight'), { timeout: 500 })
		expect(logo()).toBe('/uploads/saved-logo.png')
		expect(button('Save highlight text').disabled).toBe(true)
	})
})

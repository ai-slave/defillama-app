// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ReportHighlightControls } from '../admin/EditorialTagsView'
import { ReportRow } from '../admin/ReportsAdminView'
import type { ArticleDocument } from '../types'

const api = {
	updateArticleReportFields: vi.fn(),
	updateReportHighlightSponsorLogo: vi.fn(),
	updateEditorialTagMetadata: vi.fn(),
	publishArticle: vi.fn(),
	revalidateResearchLanding: vi.fn(async () => {})
}

vi.mock('~/auth', () => ({ useAuthContext: () => ({ authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/Articles/api', () => ({
	ArticleApiError: class ArticleApiError extends Error {},
	updateArticleReportFields: (...args: Array<unknown>) => api.updateArticleReportFields(...args),
	updateReportHighlightSponsorLogo: (...args: Array<unknown>) => api.updateReportHighlightSponsorLogo(...args),
	updateEditorialTagMetadata: (...args: Array<unknown>) => api.updateEditorialTagMetadata(...args),
	publishArticle: (...args: Array<unknown>) => api.publishArticle(...args),
	revalidateResearchLanding: () => api.revalidateResearchLanding(),
	listArticlesByTag: vi.fn(),
	setEditorialTag: vi.fn(),
	reorderEditorialTag: vi.fn(),
	unsetEditorialTag: vi.fn()
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('next/link', () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>
}))
vi.mock('~/containers/Articles/upload/ImageUploadButton', () => ({
	ImageUploadButton: ({
		label,
		onUploaded,
		onCleared
	}: {
		label: string
		onUploaded: (result: { url: string; width: number; height: number }) => void
		onCleared: () => void
	}) => (
		<>
			<button type="button" onClick={() => onUploaded({ url: '/uploads/new-logo.png', width: 64, height: 64 })}>
				upload {label}
			</button>
			<button type="button" onClick={onCleared}>
				clear {label}
			</button>
		</>
	)
}))
vi.mock('~/containers/Articles/upload/PdfUploadButton', () => ({ PdfUploadButton: () => null }))
vi.mock('~/containers/Articles/admin/ArticlePicker', () => ({ ArticlePicker: () => null }))
vi.mock('~/containers/Articles/admin/EditorialTagRow', () => ({ EditorialTagRow: () => null }))
vi.mock('~/containers/Articles/admin/ReorderableEditorialTagList', () => ({ ReorderableEditorialTagList: () => null }))

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

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: Error) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

async function flush() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

describe('admin drafts around saves', () => {
	let container: HTMLDivElement
	let root: Root

	function render(element: ReactElement) {
		return act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					{element}
				</QueryClientProvider>
			)
		})
	}

	function textarea() {
		return container.querySelector('textarea')!
	}

	function type(value: string) {
		const el = textarea()
		const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
		return act(async () => {
			setValue.call(el, value)
			el.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

	function click(text: string) {
		const el = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
		if (!el) throw new Error(`No button "${text}"`)
		return act(async () => {
			el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		for (const fn of Object.values(api)) fn.mockReset()
		api.revalidateResearchLanding.mockResolvedValue(undefined)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('report row: text typed while a save is in flight survives the save completing', async () => {
		const save = deferred<ArticleDocument>()
		api.updateArticleReportFields.mockReturnValue(save.promise)
		await render(<ReportRow article={article} />)

		await type('B')
		await click('Save')
		expect(api.updateArticleReportFields).toHaveBeenCalledWith(
			'article-1',
			expect.objectContaining({ reportDescription: 'B' }),
			expect.anything()
		)

		await type('C')
		await act(async () => save.resolve({ ...article, reportDescription: 'B' }))
		await flush()

		expect(textarea().value).toBe('C')
		expect(container.textContent).not.toContain('changed elsewhere')
	})

	test('report row: a save with no edits in flight ends clean with the stored value', async () => {
		api.updateArticleReportFields.mockImplementation(async () => ({ ...article, reportDescription: 'B' }))
		await render(<ReportRow article={article} />)

		await type('  B  ')
		await click('Save')
		await flush()

		expect(textarea().value).toBe('B')
		const saveButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save')!
		expect(saveButton.disabled).toBe(true)
	})

	test('highlight controls: uploading a sponsor logo keeps unsaved highlight text', async () => {
		api.updateReportHighlightSponsorLogo.mockImplementation(async (_id: string, logo: unknown) => ({
			...article,
			sponsorLogo: logo
		}))
		await render(<ReportHighlightControls article={article} pending={false} invalidate={vi.fn()} />)

		await type('Draft highlight')
		await click('upload sponsor logo')
		await flush()

		expect(textarea().value).toBe('Draft highlight')
		expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/new-logo.png')
		expect(container.textContent).not.toContain('changed elsewhere')
	})

	test('highlight controls: a rejected logo removal puts the saved logo back and keeps the text draft', async () => {
		const withLogo = { ...article, sponsorLogo: { url: '/uploads/saved-logo.png', width: 64, height: 64 } }
		const removal = deferred<never>()
		api.updateReportHighlightSponsorLogo.mockReturnValue(removal.promise)
		await render(<ReportHighlightControls article={withLogo} pending={false} invalidate={vi.fn()} />)

		await type('Draft highlight')
		await click('clear sponsor logo')
		// Optimistic: the logo is gone while the request runs.
		expect(container.querySelector('img')).toBeNull()

		await act(async () => removal.reject(new Error('offline')))
		await flush()
		expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/saved-logo.png')
		expect(textarea().value).toBe('Draft highlight')
	})

	test('highlight controls: a rejected replacement does not undo a newer upload that succeeded', async () => {
		const failing = deferred<never>()
		api.updateReportHighlightSponsorLogo
			.mockReturnValueOnce(failing.promise)
			.mockImplementationOnce(async (_id: string, logo: unknown) => ({ ...article, sponsorLogo: logo }))
		await render(<ReportHighlightControls article={article} pending={false} invalidate={vi.fn()} />)

		await click('upload sponsor logo')
		await click('upload sponsor logo')
		await flush()
		expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/new-logo.png')

		await act(async () => failing.reject(new Error('offline')))
		await flush()
		expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/new-logo.png')
	})

	test('highlight controls: saving the text keeps the logo and ends clean', async () => {
		api.updateEditorialTagMetadata.mockImplementation(async () => ({ metadata: { highlightText: 'New highlight' } }))
		const withLogo = { ...article, sponsorLogo: { url: '/uploads/saved-logo.png', width: 64, height: 64 } }
		await render(<ReportHighlightControls article={withLogo} pending={false} invalidate={vi.fn()} />)

		await type('  New highlight  ')
		await click('Save highlight text')
		await flush()

		expect(textarea().value).toBe('New highlight')
		expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/saved-logo.png')
		const saveButton = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Save highlight text'
		)!
		expect(saveButton.disabled).toBe(true)
	})
})

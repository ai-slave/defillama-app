// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { listArticles } from '~/containers/Articles/api'
import { createEmptyLocalArticle } from '~/containers/Articles/document'
import { listResearchNewsletterItems } from '~/containers/Articles/newsletterFeed'
import { ResearchSearchDialog } from './ResearchSearchDialog'

vi.mock('~/containers/Articles/api', () => ({ listArticles: vi.fn() }))
vi.mock('~/containers/Articles/newsletterFeed', () => ({
	listResearchNewsletterItems: vi.fn()
}))
let container: HTMLDivElement
let root: Root
let client: QueryClient
beforeEach(async () => {
	vi.clearAllMocks()
	vi.mocked(listArticles).mockResolvedValue({
		items: [
			{
				...createEmptyLocalArticle(),
				id: 'report',
				title: 'Liquidity report',
				slug: 'liquidity-report',
				section: 'report',
				authorProfile: { slug: 'author', displayName: 'Author', socials: {}, createdAt: '', updatedAt: '' }
			}
		],
		page: 1,
		perPage: 6,
		totalItems: 1,
		totalPages: 1
	})
	vi.mocked(listResearchNewsletterItems).mockResolvedValue({
		items: [
			{
				id: 'newsletter',
				title: 'Weekly research notes',
				description: null,
				href: 'https://example.com/weekly-notes',
				imageUrl: null,
				publishedAt: null
			}
		],
		totalItems: 1
	})
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ResearchSearchDialog variant="desktop" />
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
function radio(label: string) {
	return [...document.querySelectorAll<HTMLElement>('input[type="radio"]')].find(
		(el) => el.closest('label')?.textContent === label
	)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.click()
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
}
function resultTitles() {
	return [...document.querySelectorAll('[role="dialog"] a')].map((el) => el.textContent)
}
async function expectResults(titles: Array<string>) {
	await vi.waitFor(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(resultTitles()).toEqual(titles.map((title) => expect.stringContaining(title)))
	})
}
test('arrow selection changes the request, All types restores mixed content, and reopening resets the filter', async () => {
	expect(listArticles).not.toHaveBeenCalled()
	const trigger = container.querySelector<HTMLButtonElement>('button')!
	await click(trigger)
	expect(radio('All types').getAttribute('aria-checked')).toBe('true')
	expect(listResearchNewsletterItems).toHaveBeenCalled()
	await expectResults(['Liquidity report', 'Weekly research notes'])
	await act(async () => {
		radio('All types').focus()
		radio('All types').dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		)
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
	expect(radio('Reports').getAttribute('aria-checked')).toBe('true')
	expect(listArticles).toHaveBeenLastCalledWith(expect.objectContaining({ section: 'report' }))
	await expectResults(['Liquidity report'])
	await click(radio('Newsletters'))
	expect(radio('Newsletters').getAttribute('aria-checked')).toBe('true')
	await expectResults(['Weekly research notes'])
	await click(radio('All types'))
	expect(radio('All types').getAttribute('aria-checked')).toBe('true')
	await expectResults(['Liquidity report', 'Weekly research notes'])
	await click(radio('Reports'))
	await click(document.querySelector<HTMLElement>('[aria-label="Close Research search"]')!)
	expect(document.activeElement).toBe(trigger)
	await click(trigger)
	expect(radio('All types').getAttribute('aria-checked')).toBe('true')
})

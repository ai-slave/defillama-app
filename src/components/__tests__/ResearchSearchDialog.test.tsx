// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { createEmptyLocalArticle } from '~/containers/Articles/document'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ResearchSearchDialog } from '../ResearchSearchDialog'

const ARTICLE_NOW = '2026-07-14T00:00:00.000Z'

const http = installFixtureFetch()
const articlesUrl = `${FEATURES_SERVER}/articles`
let container: HTMLDivElement
let root: Root
let client: QueryClient
beforeEach(async () => {
	vi.clearAllMocks()
	http.serve({
		[articlesUrl]: {
			items: [
				{
					...createEmptyLocalArticle(ARTICLE_NOW),
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
		}
	})
	http.serve({
		'/api/public/research/newsletters': {
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
		}
	})
	http.serve({
		[`${FEATURES_SERVER}/research/clients`]: { clients: [{ id: 'c1', displayName: 'Forgd' }] }
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
	await waitForUi(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(resultTitles()).toEqual(titles.map((title) => expect.stringContaining(title)))
	})
}
test('arrow selection changes the request, All types restores mixed content, and reopening resets the filter', async () => {
	expect(http.requests).toHaveLength(0)
	const trigger = container.querySelector<HTMLButtonElement>('button')!
	await click(trigger)
	expect(radio('All types').getAttribute('aria-checked')).toBe('true')
	expect(http.requests.some(({ url }) => url.pathname === '/api/public/research/newsletters')).toBe(true)
	await expectResults(['Liquidity report', 'Weekly research notes'])
	await act(async () => {
		radio('All types').focus()
		radio('All types').dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		)
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
	expect(radio('Reports').getAttribute('aria-checked')).toBe('true')
	expect(http.requests.findLast(({ url }) => url.href.startsWith(articlesUrl))?.url.searchParams.get('section')).toBe(
		'report'
	)
	await expectResults(['Liquidity report'])
	await click(radio('Newsletters'))
	expect(radio('Newsletters').getAttribute('aria-checked')).toBe('true')
	await expectResults(['Weekly research notes'])
	await click(radio('All types'))
	expect(radio('All types').getAttribute('aria-checked')).toBe('true')
	await expectResults(['Liquidity report', 'Weekly research notes'])
	await click(radio('Reports'))
	await click(document.querySelector<HTMLElement>('[aria-label="Close dialog"]')!)
	expect(document.activeElement).toBe(trigger)
	await click(trigger)
	expect(radio('All types').getAttribute('aria-checked')).toBe('true')
})

test('a failed search does not claim to be searching', async () => {
	http.serve({
		[articlesUrl]: () => new Response('down', { status: 503 }),
		'/api/public/research/newsletters': () => new Response('down', { status: 503 })
	})
	await click(container.querySelector<HTMLButtonElement>('button')!)
	await waitForUi(() => expect(document.querySelector('[role="dialog"] [role="alert"]')).not.toBeNull())
	expect(document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent).toBe('')
})

test('an empty feed leaves the count blank instead of saying 0 newest', async () => {
	http.serve({
		[articlesUrl]: { items: [], page: 1, perPage: 6, totalItems: 0, totalPages: 0 },
		'/api/public/research/newsletters': { items: [], totalItems: 0 }
	})
	await click(container.querySelector<HTMLButtonElement>('button')!)
	await waitForUi(() =>
		expect(document.querySelector('[role="dialog"]')?.textContent).toContain('No published content yet')
	)
	expect(document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent).toBe('')
})

test('a Trusted by pick narrows Research to that company, leaves newsletters out, and All restores them', async () => {
	await click(container.querySelector<HTMLButtonElement>('button')!)
	await expectResults(['Liquidity report', 'Weekly research notes'])

	const trustedBy = () =>
		[...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find((b) =>
			b.textContent?.startsWith('Trusted by')
		)!
	const pick = async (name: string) => {
		await click(trustedBy())
		const option = await waitForUi(() => {
			const match = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent === name)
			expect(match).toBeDefined()
			return match!
		})
		await click(option)
	}

	const newsletterRequests = () =>
		http.requests.filter(({ url }) => url.pathname === '/api/public/research/newsletters').length
	await pick('Forgd')
	const newslettersBefore = newsletterRequests()
	await expectResults(['Liquidity report'])
	expect(http.requests.findLast(({ url }) => url.href.startsWith(articlesUrl))?.url.searchParams.get('client')).toBe(
		'c1'
	)
	expect(newsletterRequests()).toBe(newslettersBefore)
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Trusted by Forgd')

	await pick('All')
	await expectResults(['Liquidity report', 'Weekly research notes'])
})

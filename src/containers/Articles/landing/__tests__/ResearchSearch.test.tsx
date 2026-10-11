// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { createEmptyLocalArticle } from '../../document'
import ResearchSearch from '../ResearchSearch'

const router = vi.hoisted(() => ({
	pathname: '/research',
	query: {} as Record<string, string>,
	isReady: true,
	push: vi.fn(),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
const http = installFixtureFetch()

let root: Root
let container: HTMLDivElement
let client: QueryClient

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	router.query = { q: 'aave' }
	router.push.mockReset()
	http.serve({
		[`${FEATURES_SERVER}/articles`]: { items: [], totalItems: 0, totalPages: 1 },
		[`${FEATURES_SERVER}/research/clients`]: { clients: [] }
	})
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ResearchSearch />
			</QueryClientProvider>
		)
	)
}

/** Next re-renders the page with the query of the URL it moved to. */
async function navigate(href: string) {
	router.query = Object.fromEntries(new URL(href, 'https://defillama.com').searchParams)
	await render()
}

const input = () => container.querySelector<HTMLInputElement>('input[name="q"]')!

async function type(value: string) {
	await act(async () => {
		input().focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
		input().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('the search box follows the URL query, even while focused, and submits what the reader typed', async () => {
	await render()
	expect(input().value).toBe('aave')

	// Back to another search while the box has focus and an unsent draft.
	await type('aave fees')
	await navigate('/research?q=compound')
	expect(document.activeElement).toBe(input())
	expect(input().value).toBe('compound')

	// Forward again: the discarded draft stays discarded.
	await navigate('/research?q=aave')
	expect(input().value).toBe('aave')

	await type('  maker  ')
	await act(async () => input().form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	expect(router.push).toHaveBeenCalledWith('/research?q=maker', undefined, { shallow: false, scroll: false })
	await navigate(router.push.mock.calls[0][0])
	expect(input().value).toBe('maker')
	expect(document.activeElement).toBe(input())
})

const pageOf = (page: number) => ({
	items: [
		{
			...createEmptyLocalArticle('2026-09-01T00:00:00.000Z'),
			id: `a${page}`,
			title: `Article on page ${page}`,
			slug: `a${page}`
		}
	],
	totalItems: 48,
	totalPages: 2
})
const nextButton = () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Next'))!

test('paging keeps the results and the pressed Next on screen until the next page arrives', async () => {
	const second = Promise.withResolvers<Response>()
	http.serve({
		[`${FEATURES_SERVER}/articles`]: (url: URL) => (url.searchParams.get('page') === '2' ? second.promise : pageOf(1))
	})
	await render()
	await waitForUi(() => expect(container.textContent).toContain('Article on page 1'))
	await act(async () => {
		nextButton().focus()
		nextButton().click()
	})
	await navigate(router.push.mock.calls[0][0])
	expect(container.textContent).toContain('Article on page 1')
	expect(document.activeElement).toBe(nextButton())

	await act(async () => second.resolve(Response.json(pageOf(2))))
	await waitForUi(() => expect(container.textContent).toContain('Article on page 2'))
	// The last page disables Next, which keeps focus.
	expect(document.activeElement).toBe(nextButton())
	expect(nextButton().getAttribute('aria-disabled')).toBe('true')
})

test('a failed search announces its error in the results with a Try again, keeps the search box, and shows no count', async () => {
	http.serve({ [`${FEATURES_SERVER}/articles`]: fixtureStatus(500, { error: 'Search is down' }) })
	await render()
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	expect(alertTexts(container)[0]).not.toContain('Search is down')
	expect(container.textContent).not.toContain('0 results')
	expect(input().value).toBe('aave')

	http.serve({ [`${FEATURES_SERVER}/articles`]: pageOf(1) })
	await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Try again')!.click())
	await waitForUi(() => expect(container.textContent).toContain('Article on page 1'))
	expect(alertTexts(container)).toEqual([])
})

test('a page that fails to load hands focus from the pressed Next to the page, and the retry that loads it does too', async () => {
	const main = document.createElement('main')
	document.body.append(main)
	main.append(container)
	http.serve({
		[`${FEATURES_SERVER}/articles`]: (url: URL) =>
			url.searchParams.get('page') === '2' ? fixtureStatus(500, { error: 'Search is down' }) : pageOf(1)
	})
	await render()
	await waitForUi(() => expect(container.textContent).toContain('Article on page 1'))
	await act(async () => {
		nextButton().focus()
		nextButton().click()
	})
	await navigate(router.push.mock.calls[0][0])
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	expect(document.activeElement).toBe(main)

	http.serve({ [`${FEATURES_SERVER}/articles`]: pageOf(2) })
	const retry = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Try again')!
	await act(async () => {
		retry.focus()
		retry.click()
	})
	await waitForUi(() => expect(container.textContent).toContain('Article on page 2'))
	expect(document.activeElement).toBe(main)
	main.remove()
})

test('the section links mark the URL section as the current page, and All when none is picked', async () => {
	http.serve({
		[`${FEATURES_SERVER}/articles/sections`]: {
			sections: [
				{ section: 'spotlight', items: [] },
				{ section: 'report', items: [] }
			]
		}
	})
	const current = () =>
		[...container.querySelectorAll('nav[aria-labelledby] a[aria-current="page"]')].map((link) => link.textContent)
	await render()
	await waitForUi(() => expect(container.querySelectorAll('nav[aria-labelledby] a')).toHaveLength(3))
	expect(current()).toEqual(['All'])

	await navigate('/research?q=aave&section=report')
	expect(current()).toEqual(['report'])
})

test('a client filter narrows the results, names the client, survives paging, and clears back to all clients', async () => {
	router.query = { client: 'c1' }
	http.serve({
		[`${FEATURES_SERVER}/research/clients`]: {
			clients: [
				{ id: 'c1', displayName: 'Starknet' },
				{ id: 'c2', displayName: 'Aave' }
			]
		},
		[`${FEATURES_SERVER}/articles`]: {
			...pageOf(1),
			items: [
				{ ...pageOf(1).items[0], client: { id: 'c1', displayName: 'Starknet', relation: 'sponsored' } },
				{
					...pageOf(1).items[0],
					id: 'b1',
					title: 'Joint study',
					slug: 'b1',
					client: { id: 'c1', displayName: 'Starknet', relation: 'collaboration' }
				}
			]
		}
	})
	await render()
	await waitForUi(() => expect(container.textContent).toContain('Article on page 1'))

	const articleRequest = http.requests.find((request) => request.url.pathname === '/articles')!
	expect(articleRequest.url.searchParams.get('client')).toBe('c1')
	expect(container.querySelector('h1')?.textContent).toBe('Client Starknet')
	const clientLinks = [...container.querySelectorAll('li a')].filter(
		(a) => a.getAttribute('href') === '/research?client=c1'
	)
	expect(clientLinks.map((a) => a.textContent)).toEqual(['Sponsored by Starknet', 'In collaboration with Starknet'])

	await act(async () => nextButton().click())
	expect(router.push).toHaveBeenLastCalledWith('/research?client=c1&page=2', undefined, {
		shallow: false,
		scroll: false
	})

	const trigger = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Starknet'))!
	await act(async () => trigger.click())
	const allClients = await waitForUi(() => {
		const option = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent === 'All clients')
		expect(option).toBeDefined()
		return option as HTMLElement
	})
	await act(async () => allClients.click())
	expect(router.push).toHaveBeenLastCalledWith('/research', undefined, { shallow: false, scroll: false })
})

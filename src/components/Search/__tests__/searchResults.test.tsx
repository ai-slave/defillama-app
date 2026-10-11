// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SEARCH_API_URL } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SEARCH_API_TOKEN = 'test-token'
})
vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/' }) }))

const { SiteSearchHotkey } = await import('../index')

const { serve } = installFixtureFetch()
const hit = (i: number) => ({ name: `Protocol ${i}`, route: `/protocol/p-${i}`, type: 'Protocol' })
let root: Root
let container: HTMLDivElement

beforeEach(async () => {
	serve({ 'https://defillama-datasets.llama.fi/searchlist.json': [] })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<SiteSearchHotkey />
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function searchFor(query: string) {
	await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true })))
	const input = await waitForUi(() => {
		const element = document.querySelector<HTMLInputElement>('input[aria-label="Search"]')
		expect(element).not.toBeNull()
		return element!
	})
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, query)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('a See more retry waits in its Try again, with the error on screen, until the next page loads', async () => {
	let page2 = 0
	const retry = Promise.withResolvers<Response>()
	serve({
		[SEARCH_API_URL]: (_url: URL, init?: RequestInit) => {
			const { queries } = JSON.parse(init!.body as string) as { queries: Array<{ offset: number }> }
			if (queries[0].offset === 0)
				return { results: [{ hits: Array.from({ length: 20 }, (_, i) => hit(i + 1)) }, { hits: [] }] }
			page2++
			// A 400, which fetchJson does not retry by itself, so the first attempt is the failure the reader sees.
			return page2 === 1 ? new Response('down', { status: 400 }) : retry.promise
		}
	})
	await searchFor('protocol')
	const button = (text: string) => [...document.querySelectorAll('button')].find((b) => accessibleName(b) === text)
	const seeMore = await waitForUi(() => {
		expect(button('See more')).toBeDefined()
		return button('See more')!
	})
	await act(async () => seeMore.click())
	await waitForUi(() => expect(alertTexts()).toHaveLength(1))
	expect(document.body.textContent).toContain('Protocol 20')
	await act(async () => button('Try again')!.click())
	await waitForUi(() => expect(button('Retrying…')?.getAttribute('aria-busy')).toBe('true'))
	expect(alertTexts()).toHaveLength(1)
	await act(async () => retry.resolve(Response.json({ results: [{ hits: [hit(21)] }] })))
	await waitForUi(() => expect(document.body.textContent).toContain('Protocol 21'))
	expect(alertTexts()).toEqual([])
})

test('token results show their symbol and protocol results do not', async () => {
	serve({
		[SEARCH_API_URL]: {
			results: [
				{
					hits: [
						{ name: 'Hyperliquid', symbol: 'HYPE', route: '/token/HYPE', type: 'Token' },
						{ name: 'Hyperliquid', symbol: 'HYPE', route: '/protocol/hyperliquid', type: 'Protocol' }
					]
				},
				{ hits: [] }
			]
		}
	})
	await searchFor('hype')
	const option = (href: string) => document.querySelector(`[role="option"][href="${href}"]`)
	await waitForUi(() => expect(option('/token/HYPE')?.textContent).toContain('HYPE'))
	expect(option('/protocol/hyperliquid')?.textContent).not.toContain('HYPE')
})

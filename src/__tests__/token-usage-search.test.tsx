// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'

// constants read the search token at import time; without it searchApi skips the request.
vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SEARCH_API_TOKEN = 'test-token'
})

import { SEARCH_API_URL } from '~/constants'
import { TokenUsageSearch } from '~/pages/token-usage'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'

const http = installFixtureFetch()

const mocks = vi.hoisted(() => ({
	router: {
		isReady: false,
		pathname: '/token-usage',
		asPath: '/token-usage',
		query: { token: 'ETH' } as { token?: string | Array<string> },
		push: vi.fn().mockResolvedValue(true)
	}
}))

vi.mock('next/router', () => ({
	useRouter: () => mocks.router
}))

describe('TokenUsageSearch', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.router.isReady = false
		mocks.router.query = { token: 'ETH' }
		mocks.router.push.mockClear()
		container = document.createElement('div')
		document.body.appendChild(container)
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		http.serve({ [SEARCH_API_URL]: { results: [{ hits: [] }] } })
	})

	afterEach(async () => {
		await act(async () => root?.unmount())
		queryClient.clear()
		container.remove()
	})

	async function renderSearch() {
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<TokenUsageSearch />
				</QueryClientProvider>
			)
		})
	}

	test('preserves text entered before hydration when the router becomes ready', async () => {
		container.innerHTML = '<input id="token-usage-search-input" value="sol" />'
		root = createRoot(container)

		await renderSearch()
		expect(container.querySelector('input')?.value).toBe('sol')

		mocks.router.isReady = true
		await renderSearch()

		expect(container.querySelector('input')?.value).toBe('sol')
	})

	test('shows the selected URL symbol after hydration when the user has not typed', async () => {
		root = createRoot(container)

		await renderSearch()
		expect(container.querySelector('input')?.value).toBe('')

		mocks.router.isReady = true
		await renderSearch()

		expect(container.querySelector('input')?.value).toBe('ETH')
	})

	async function type(value: string) {
		const input = container.querySelector('input')!
		await act(async () => {
			input.focus()
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

	test('shows the URL symbol of a later navigation until the reader types', async () => {
		mocks.router.isReady = true
		root = createRoot(container)
		await renderSearch()
		expect(container.querySelector('input')?.value).toBe('ETH')

		mocks.router.query = { token: 'SOL' }
		await renderSearch()
		expect(container.querySelector('input')?.value).toBe('SOL')
	})

	test('a field the reader cleared stays empty when the URL symbol changes', async () => {
		mocks.router.isReady = true
		root = createRoot(container)
		await renderSearch()

		await type('')
		mocks.router.query = { token: 'SOL' }
		await renderSearch()

		expect(container.querySelector('input')?.value).toBe('')
	})

	test('writes the selected token symbol to the URL', async () => {
		mocks.router.isReady = true
		mocks.router.query = {}
		container.innerHTML = '<input id="token-usage-search-input" value="ethereum" />'
		http.serve({
			[SEARCH_API_URL]: {
				results: [{ hits: [{ id: 'coingecko_ethereum_token', name: 'Ethereum', symbol: 'eth', mcapRank: 2 }] }]
			}
		})
		root = createRoot(container)
		await renderSearch()

		await act(async () => container.querySelector('button')?.click())
		await waitForUi(() => expect(document.querySelector('[role="option"]')?.textContent).toContain('Ethereum'))
		const option = document.querySelector<HTMLElement>('[role="option"]')

		await act(async () => option?.click())

		expect(mocks.router.push).toHaveBeenCalledWith({ pathname: '/token-usage', query: { token: 'ETH' } }, undefined, {
			shallow: true
		})
	})
})

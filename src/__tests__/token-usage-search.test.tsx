// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TokenUsageSearch } from '~/pages/token-usage'

const mocks = vi.hoisted(() => ({
	router: {
		isReady: false,
		query: { token: 'ETH' } as { token?: string | Array<string> }
	},
	searchTokens: vi.fn().mockResolvedValue([]),
	pushShallowQuery: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('next/router', () => ({
	useRouter: () => mocks.router
}))

vi.mock('~/containers/TokenSearch/search', () => ({
	searchTokens: mocks.searchTokens
}))

vi.mock('~/utils/routerQuery', () => ({
	pushShallowQuery: mocks.pushShallowQuery
}))

describe('TokenUsageSearch', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		mocks.router.isReady = false
		mocks.router.query = { token: 'ETH' }
		mocks.searchTokens.mockClear()
		mocks.pushShallowQuery.mockClear()
		container = document.createElement('div')
		document.body.appendChild(container)
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

	test('writes the selected token symbol to the URL', async () => {
		mocks.router.isReady = true
		mocks.router.query = {}
		container.innerHTML = '<input id="token-usage-search-input" value="ethereum" />'
		queryClient.setQueryData(
			['token-usage', 'search-tokens', 'ethereum'],
			[
				{
					id: 'ethereum',
					searchId: 'coingecko:ethereum:token',
					coinKey: 'coingecko:ethereum',
					name: 'Ethereum',
					symbol: 'ETH',
					logo: 'https://example.com/eth.png',
					rank: 2
				}
			]
		)
		root = createRoot(container)
		await renderSearch()

		await act(async () => container.querySelector('button')?.click())
		const option = document.querySelector<HTMLElement>('[role="option"]')
		expect(option?.textContent).toContain('Ethereum')

		await act(async () => option?.click())

		expect(mocks.pushShallowQuery).toHaveBeenCalledWith(mocks.router, { token: 'ETH' })
	})
})

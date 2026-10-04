// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import Correlations from '..'

const http = installFixtureFetch()

const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/correlation',
	asPath: '/correlation',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn(),
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

const token = (id: string, symbol: string): TokenSearchResult => ({
	id,
	searchId: `coingecko:${id}`,
	coinKey: `coingecko:${id}`,
	name: id,
	symbol,
	logo: `/icons/${id}.png`,
	rank: 1
})
const TOKENS = [
	token('bitcoin', 'BTC'),
	token('ethereum', 'ETH'),
	token('tether', 'USDT'),
	token('binancecoin', 'BNB'),
	token('solana', 'SOL')
]

let container: HTMLDivElement
let root: Root
let queryClient: QueryClient

const page = () => (
	<QueryClientProvider client={queryClient}>
		<Correlations initialTokenOptions={TOKENS} />
	</QueryClientProvider>
)

// Shallow routing re-renders the page with the new query; the mock does the same.
router.push.mockImplementation(async ({ query }: { query: Record<string, string | Array<string>> }) => {
	router.query = query
	await act(async () => root.render(page()))
})

// The token column: a "Tokens" heading, one "Remove <symbol>" button per token, then "Add token".
const tokenButtons = () =>
	[...container.querySelectorAll('h2')]
		.find((heading) => heading.textContent === 'Tokens')
		?.parentElement?.querySelectorAll('button') ?? []
const listedTokens = () =>
	[...tokenButtons()]
		.map((button) => button.textContent)
		.filter((text) => text !== 'Add token')
		.map((text) => text?.replace(/^Remove /, ''))

beforeEach(() => {
	for (const { id } of TOKENS) http.serve({ [`/api/public/tokens/charts/coingecko/${id}`]: { data: { prices: [] } } })
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	queryClient.clear()
	container.remove()
	router.query = {}
	router.push.mockClear()
	router.replace.mockClear()
})

test('a URL without coins shows the default tokens without rewriting the URL', async () => {
	await act(async () => root.render(page()))

	await waitForUi(() => expect(listedTokens()).toEqual(['BTC', 'ETH', 'USDT', 'BNB']))
	expect(router.replace).not.toHaveBeenCalled()

	await act(async () => tokenButtons()[0].click())
	expect(router.query).toEqual({ coin: ['ethereum', 'tether', 'binancecoin'] })
	expect(listedTokens()).toEqual(['ETH', 'USDT', 'BNB'])
})

test('removing the last coin from the URL shows the default tokens again', async () => {
	router.query = { coin: 'solana' }
	await act(async () => root.render(page()))
	await waitForUi(() => expect(listedTokens()).toEqual(['SOL']))

	await act(async () => tokenButtons()[0].click())

	expect(router.query).toEqual({})
	await waitForUi(() => expect(listedTokens()).toEqual(['BTC', 'ETH', 'USDT', 'BNB']))
})

// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { RawBridgeInfo, RawBridgeTransactionsPage } from '../api.types'
import { BridgeTransactionsPage } from '../Transactions'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/bridge-transactions', query: {}, push: vi.fn() }) }))

const http = installFixtureFetch()
const bridge = { id: 7, name: 'portal', displayName: 'Portal', last24hVolume: 1, chains: ['Ethereum'] } as RawBridgeInfo

let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

const button = (text: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.textContent?.trim() === text || el.getAttribute('aria-label') === text
	)!

async function pickPortal() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<BridgeTransactionsPage bridges={[bridge]} />
			</QueryClientProvider>
		)
	)
	await act(async () => button('Select a bridge').click())
	const option = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
			(el) => el.textContent === 'Portal'
		)
		expect(found).toBeDefined()
		return found!
	})
	await act(async () => option.click())
	return button('Fetch Transactions')
}

test('Fetch keeps focus while transactions load, and the pager stays focusable at the first page', async () => {
	const page = Promise.withResolvers<RawBridgeTransactionsPage>()
	http.serve({
		'https://defillama-datasets.llama.fi/blockExplorers.json': [],
		'/api/public/bridges/transactions/7': () => page.promise
	})
	const fetchButton = await pickPortal()
	await act(async () => {
		fetchButton.focus()
		fetchButton.click()
	})
	await waitForUi(() => expect(fetchButton.getAttribute('aria-busy')).toBe('true'))
	expect(fetchButton.disabled).toBe(false)
	expect(document.activeElement).toBe(fetchButton)
	const ts = new Date(Date.now() - 86_400_000).toISOString()
	await act(async () =>
		page.resolve({
			hasMore: false,
			rows: [
				{
					tx_hash: '0x1',
					ts,
					tx_block: 1,
					tx_from: '0xa',
					tx_to: '0xb',
					token: '0xc',
					amount: '1',
					is_deposit: true,
					is_usd_volume: true,
					chain: 'ethereum',
					bridge_name: 'portal',
					usd_value: '10'
				}
			]
		})
	)
	const first = await waitForUi(() => {
		const found = button('First page')
		expect(found).toBeDefined()
		return found
	})
	expect(first.disabled).toBe(false)
	expect(first.getAttribute('aria-disabled')).toBe('true')
})

test('a failed fetch keeps its error on screen while the retry loads', async () => {
	http.serve({ 'https://defillama-datasets.llama.fi/blockExplorers.json': [] })
	// A page that says there is more but gives no cursor fails the fetch; the retry never answers.
	http.serveInOrder('/api/public/bridges/transactions/7', [{ hasMore: true, rows: [] }, () => new Promise(() => {})])
	const fetchButton = await pickPortal()
	const alertText = 'Bridge transactions response is missing its continuation cursor'
	await act(async () => fetchButton.click())
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe(alertText))

	await act(async () => fetchButton.click())
	await waitForUi(() => expect(fetchButton.getAttribute('aria-busy')).toBe('true'))
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(alertText)
})

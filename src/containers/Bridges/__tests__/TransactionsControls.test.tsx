// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
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

const typeDate = (input: HTMLInputElement, value: string) =>
	act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
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
			// Two pages, so the pager has somewhere to go.
			rows: Array.from({ length: 101 }, (_, index) => ({
				tx_hash: `0x${index}`,
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
			}))
		})
	)
	const first = await waitForUi(() => {
		const found = button('Go to first page')
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
	await act(async () => fetchButton.click())
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	const alertText = document.querySelector('[role="alert"]')!.textContent
	expect(alertText).not.toContain('continuation cursor')

	await act(async () => fetchButton.click())
	await waitForUi(() => expect(fetchButton.getAttribute('aria-busy')).toBe('true'))
	expect(document.querySelector('[role="alert"]')?.textContent).toBe(alertText)
})

test('Fetch says what is missing under its field, focuses it, and puts an inverted range under the end date', async () => {
	http.serve({ 'https://defillama-datasets.llama.fi/blockExplorers.json': [] })
	const fetchRequests = () => http.requests.filter((request) => request.url.pathname.startsWith('/api/public/bridges'))
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<BridgeTransactionsPage bridges={[bridge]} />
			</QueryClientProvider>
		)
	)
	const trigger = button('Select a bridge')
	const fetchButton = button('Fetch Transactions')
	expect(fetchButton.getAttribute('aria-disabled')).toBeNull()
	await act(async () => fetchButton.click())
	expect(fieldErrorOf(trigger)).toBeTruthy()
	expect(document.activeElement).toBe(trigger)

	await pickPortal()
	expect(trigger.getAttribute('aria-invalid')).toBeNull()
	const [start, end] = [...document.querySelectorAll<HTMLInputElement>('input[type="date"]')]
	await typeDate(end, '2000-01-01')
	expect(fieldErrorOf(end)).toBe('Choose an end date on or after the start date.')
	expect(start.getAttribute('aria-invalid')).toBeNull()
	await act(async () => fetchButton.click())
	expect(document.activeElement).toBe(end)
	expect(fetchRequests()).toHaveLength(0)
})

test('the end date may be the UTC today while the reader is still on the day before', async () => {
	// 02:56 UTC on Oct 2 is the evening of Oct 1 in Los Angeles; date-only values are UTC days.
	const originalTimeZone = process.env.TZ
	process.env.TZ = 'America/Los_Angeles'
	vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-02T02:56:00Z') })
	try {
		http.serve({
			'https://defillama-datasets.llama.fi/blockExplorers.json': [],
			'/api/public/bridges/transactions/7': { hasMore: false, rows: [] }
		})
		const fetchButton = await pickPortal()
		const end = document.querySelector<HTMLInputElement>('input[name="endDate"]')!
		await typeDate(end, '2026-10-03')
		await act(async () => fetchButton.click())
		expect(fieldErrorOf(end)).toBe('Choose an end date no later than today.')

		await typeDate(end, '2026-10-02')
		expect(fieldErrorOf(end)).toBeNull()
		await act(async () => fetchButton.click())
		await waitForUi(() =>
			expect(http.requests.map((request) => request.url.pathname)).toContain('/api/public/bridges/transactions/7')
		)
	} finally {
		vi.useRealTimers()
		if (originalTimeZone === undefined) delete process.env.TZ
		else process.env.TZ = originalTimeZone
	}
})

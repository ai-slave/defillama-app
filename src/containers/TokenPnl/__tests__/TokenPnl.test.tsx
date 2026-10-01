// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { COINS_SERVER_URL } from '~/constants'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { PageClockProvider } from '~/hooks/usePageClock'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { TokenPnl } from '..'

const http = installFixtureFetch()

const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/token-pnl',
	asPath: '/token-pnl',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

const NOW_SEC = Date.UTC(2026, 8, 30, 12) / 1e3

const token = (id: string): TokenSearchResult => ({
	id,
	searchId: `coingecko:${id}`,
	coinKey: `coingecko:${id}`,
	name: id,
	symbol: id.slice(0, 3).toUpperCase(),
	logo: `/icons/${id}.png`,
	rank: 1
})

let container: HTMLDivElement
let root: Root
let queryClient: QueryClient

const page = () => (
	<PageClockProvider pageClockSec={NOW_SEC}>
		<QueryClientProvider client={queryClient}>
			<TokenPnl initialTokenOptions={[token('bitcoin'), token('ethereum'), token('solana')]} />
		</QueryClientProvider>
	</PageClockProvider>
)

// Shallow routing re-renders the page with the new query, read back from the URL as strings; the mock does the same.
router.push.mockImplementation(async ({ query }: { query: Record<string, string | number> }) => {
	router.query = Object.fromEntries(
		new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))
	)
	await act(async () => root.render(page()))
})

const startField = () => container.querySelector<HTMLInputElement>('input[type="date"]')!

async function pick(field: HTMLInputElement, value: string) {
	await act(async () => {
		field.focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
		field.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => field.blur())
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'], now: NOW_SEC * 1000 })
	http.serve({ [`${COINS_SERVER_URL}/chart/`]: { coins: {} } })
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
	vi.useRealTimers()
})

test('a picked start date lives in the URL, and going back to a URL without one shows the default again', async () => {
	await act(async () => root.render(page()))
	// The default range is the week up to now.
	expect(startField().value).toBe('2026-09-23')

	await pick(startField(), '2026-09-01')
	expect(router.query).toEqual({ start: String(Date.UTC(2026, 8, 1) / 1e3) })
	expect(startField().value).toBe('2026-09-01')

	// Back to the page's first history entry.
	router.query = {}
	await act(async () => root.render(page()))
	expect(startField().value).toBe('2026-09-23')
})

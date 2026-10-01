// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ProtocolRankingInitialPage, ProtocolRankingPage } from '../tableQuery'
import type { IProtocol } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/',
	asPath: '/',
	query: {} as Record<string, string>,
	push: vi.fn(async () => true),
	replace: vi.fn()
}))

vi.mock('next/router', () => ({ useRouter: () => router }))

import { ChainProtocolsTable } from '../Table'

const row = (id: string, name: string, childProtocols?: Array<IProtocol>): IProtocol => ({
	id,
	name,
	slug: id,
	chains: ['Ethereum'],
	category: 'CDP',
	tvl: { default: { tvl: 10, tvlPrevDay: 10, tvlPrevWeek: 10, tvlPrevMonth: 10 } },
	tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
	mcap: null,
	tokenPrice: null,
	mcaptvl: null,
	strikeTvl: false,
	childProtocols
})

const parent = row('maker', 'Maker', [row('maker-stability', 'Stability Module')])

const initialPage = {
	nextCursor: null,
	snapshot: 'abcdefghijklmnopqrst',
	total: 1,
	hasMore: false,
	availableActivityMetrics: []
} satisfies ProtocolRankingInitialPage

const searchPage = { ...initialPage, rows: [parent] } satisfies ProtocolRankingPage<IProtocol>

let response: ProtocolRankingPage<IProtocol> = searchPage
let loadNextPage: (() => void) | null = null

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	localStorage.clear()
	response = searchPage
	loadNextPage = null
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, status: 200, json: async () => response }) as Response)
	)
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			callback: IntersectionObserverCallback
			constructor(callback: IntersectionObserverCallback) {
				this.callback = callback
			}
			observe(element: Element) {
				// Only the table footer loads the next page.
				if (element.getAttribute('role') !== 'status') return
				loadNextPage = () =>
					this.callback(
						[{ target: element, isIntersecting: true } as IntersectionObserverEntry],
						this as unknown as IntersectionObserver
					)
			}
			unobserve() {}
			disconnect() {}
		}
	)
	container = document.createElement('div')
	document.body.appendChild(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})

const expandToggle = () =>
	[...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((button) =>
		button.textContent?.endsWith('child protocols')
	)!

const renderTable = async (page: ProtocolRankingInitialPage = initialPage) => {
	root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<ChainProtocolsTable protocols={[parent]} protocolRankings={page} chain="All" />
			</QueryClientProvider>
		)
	)
}

// Types into the search box and lets its debounce fire without waiting in real time.
const typeSearch = async (value: string) => {
	const search = container.querySelector<HTMLInputElement>('input[type="search"]')!
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	try {
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, value)
			search.dispatchEvent(new InputEvent('input', { bubbles: true }))
			await vi.advanceTimersByTimeAsync(275)
		})
	} finally {
		vi.useRealTimers()
	}
}

test('a parent that a search opened collapses when the user clicks its chevron', async () => {
	await renderTable()
	await typeSearch('stab')
	await waitForUi(() => expect(container.textContent).toContain('Stability Module'))
	expect(expandToggle().textContent).toBe('Hide child protocols')

	await act(async () => expandToggle().click())

	await waitForUi(() => expect(expandToggle().textContent).toBe('View child protocols'))
	expect(container.textContent).not.toContain('Stability Module')
})

test('a parent the user opened stays open when the next page loads', async () => {
	await renderTable({ ...initialPage, nextCursor: 'next', total: 2, hasMore: true })
	await act(async () => expandToggle().click())
	expect(container.textContent).toContain('Stability Module')

	response = { ...initialPage, total: 2, rows: [row('aave', 'Aave')] }
	await act(async () => loadNextPage!())

	await waitForUi(() => expect(container.textContent).toContain('Aave'))
	expect(expandToggle().textContent).toBe('Hide child protocols')
	expect(container.textContent).toContain('Stability Module')
})

test('searching the same text again opens the parents the earlier search had collapsed', async () => {
	await renderTable()
	await typeSearch('stab')
	await waitForUi(() => expect(expandToggle().textContent).toBe('Hide child protocols'))
	await act(async () => expandToggle().click())
	await typeSearch('')

	await typeSearch('stab')

	await waitForUi(() => expect(expandToggle().textContent).toBe('Hide child protocols'))
	expect(container.textContent).toContain('Stability Module')
})

// @vitest-environment happy-dom

import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ProtocolRankingInitialPage, ProtocolRankingPage } from '../tableQuery'
import type { IProtocol } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/',
	asPath: '/',
	query: {} as Record<string, string>,
	push: vi.fn(),
	replace: vi.fn()
}))
const toastError = vi.hoisted(() => vi.fn())

vi.mock('next/router', () => ({
	useRouter: () => router
}))

vi.mock('react-hot-toast', () => ({ default: { error: toastError } }))

// The virtualized grid is a heavy child; these tests read the loading surfaces and requests around it.
vi.mock('~/components/Table/VirtualTable', () => ({ VirtualTable: () => null }))

import { ChainProtocolsTable } from '../Table'

const protocol = {
	id: 'protocol-1',
	name: 'Protocol 1',
	slug: 'protocol-1',
	chains: ['Ethereum'],
	category: 'Dexs',
	tvl: { default: { tvl: 10, tvlPrevDay: 10, tvlPrevWeek: 10, tvlPrevMonth: 10 } },
	tvlChange: { change1d: 0, change7d: 0, change1m: 0 },
	mcap: null,
	tokenPrice: null,
	mcaptvl: null,
	strikeTvl: false
} satisfies IProtocol

const initialPage = {
	nextCursor: null,
	snapshot: 'abcdefghijklmnopqrst',
	total: 1,
	hasMore: false,
	availableActivityMetrics: [],
	tvlQuickPicks: []
} satisfies ProtocolRankingInitialPage

const responsePage = {
	...initialPage,
	rows: [protocol]
} satisfies ProtocolRankingPage<IProtocol>

const RANKINGS = '/api/public/protocol-rankings'
const http = installFixtureFetch()
const requestedSearch = (index: number, param: string) => http.requests.at(index)!.url.searchParams.get(param)

describe('Protocol Rankings hydration', () => {
	let container: HTMLDivElement
	let root: Root | null = null
	let consoleError: ReturnType<typeof vi.spyOn>
	let triggerIntersection: (() => void) | null

	const hydrateTable = async (page: ProtocolRankingInitialPage = initialPage) => {
		container.innerHTML = renderToString(
			<ChainProtocolsTable protocols={[protocol]} protocolRankings={page} chain="All" showExtendedMetrics />
		)
		await act(async () => {
			root = hydrateRoot(
				container,
				<ChainProtocolsTable protocols={[protocol]} protocolRankings={page} chain="All" showExtendedMetrics />
			)
			await Promise.resolve()
		})
	}

	// Types into the search box and lets its debounce fire without waiting in real time.
	const typeSearch = async (value: string) => {
		const search = container.querySelector<HTMLInputElement>('input[type="search"]')
		if (!search) throw new Error('Expected protocol search input')
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

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		router.query = {}
		router.push.mockReset().mockImplementation(async ({ query }) => {
			router.query = query as Record<string, string>
			return true
		})
		router.replace.mockReset()
		http.serve({ [RANKINGS]: responsePage })
		toastError.mockReset()
		triggerIntersection = null
		localStorage.clear()
		localStorage.setItem('ptcmp', 'Fees')
		localStorage.setItem('ptcp', '7d')
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				callback: IntersectionObserverCallback
				constructor(callback: IntersectionObserverCallback) {
					this.callback = callback
				}
				observe(element: Element) {
					// Focusable controls also observe visibility; trigger only the table footer.
					if (element.getAttribute('role') !== 'status') return
					triggerIntersection = () =>
						this.callback(
							[{ target: element, isIntersecting: true } as IntersectionObserverEntry],
							this as unknown as IntersectionObserver
						)
				}
				disconnect() {}
			}
		)
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(async () => {
		if (root) await act(async () => root?.unmount())
		container.remove()
		consoleError.mockRestore()
		vi.unstubAllGlobals()
	})

	test('hydrates the static TVL page before reconciling persisted client presets', async () => {
		await hydrateTable()

		const hydrationErrors = consoleError.mock.calls.filter((call: Array<unknown>) =>
			String(call[0]).toLowerCase().includes('hydration')
		)
		expect(hydrationErrors).toEqual([])
		await waitForUi(() => expect(http.requests).toHaveLength(1))
	})

	test('a persisted preset sorts by its column after hydration, and picking a period sorts by that period', async () => {
		await hydrateTable()
		await waitForUi(() => expect(http.requests).toHaveLength(1))
		expect(requestedSearch(0, 'sort')).toBe('fees_7d')

		const period1m = container.querySelector<HTMLInputElement>('input[type="radio"][value="1m"]')!
		await act(async () => period1m.click())
		await waitForUi(() => expect(http.requests).toHaveLength(2))
		expect(requestedSearch(1, 'sort')).toBe('fees_30d')
	})

	test('does not toast when an automatic persisted-preset request fails', async () => {
		http.serve({ [RANKINGS]: fixtureStatus(403) })

		await hydrateTable()
		await waitForUi(() => expect(http.requests).toHaveLength(1))

		expect(toastError).not.toHaveBeenCalled()
	})

	test('toasts when a user search request fails', async () => {
		localStorage.clear()
		http.serve({ [RANKINGS]: fixtureStatus(403) })
		await hydrateTable()
		await typeSearch('aave')

		expect(requestedSearch(-1, 'search')).toBe('aave')
		expect(toastError).toHaveBeenCalledWith("Couldn't update rankings. Please retry.", {
			id: 'protocol-rankings-update-error'
		})
	})

	test('covers stale rows while a replacement request is pending', async () => {
		localStorage.clear()
		let resolveRequest: ((response: Response) => void) | undefined
		http.serve({
			[RANKINGS]: () =>
				new Promise<Response>((resolve) => {
					resolveRequest = resolve
				})
		})
		await hydrateTable()
		await typeSearch('aave')

		expect(container.textContent).toContain('Updating rankings…')

		await act(async () => {
			resolveRequest?.(Response.json(responsePage))
		})
		await waitForUi(() => expect(container.textContent).not.toContain('Updating rankings…'))
	})

	test('keeps infinite-scroll loading in the footer without an overlay', async () => {
		localStorage.clear()
		const paginatedPage = { ...initialPage, nextCursor: 'next', total: 2, hasMore: true }
		http.serve({ [RANKINGS]: () => new Promise<Response>(() => undefined) })
		await hydrateTable(paginatedPage)
		if (!triggerIntersection) throw new Error('Expected protocol rankings scroll observer')

		act(() => triggerIntersection?.())
		await waitForUi(() => expect(container.textContent).toContain('Loading more protocols… 1 of 2'))

		expect(container.textContent).not.toContain('Updating rankings…')
	})

	test('clears persisted ranking state and requests the default page on Reset', async () => {
		router.query = { minTvl: '100' }
		localStorage.setItem('ptcfs', 'Fees')
		localStorage.setItem('ptc', JSON.stringify({ fees_7d: true }))
		await hydrateTable()
		const requestsBeforeReset = http.requests.length
		const reset = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Reset')
		if (!reset) throw new Error('Expected Reset button')

		await act(async () => {
			reset.click()
			await Promise.resolve()
		})

		expect(localStorage.getItem('ptcfs')).toBeNull()
		expect(localStorage.getItem('ptcmp')).toBeNull()
		expect(localStorage.getItem('ptcp')).toBeNull()
		expect(localStorage.getItem('ptc')).toBeNull()
		expect(http.requests).toHaveLength(requestsBeforeReset + 1)
		expect(requestedSearch(-1, 'sort')).toBe('tvl')
		expect(requestedSearch(-1, 'minTvl')).toBeNull()
	})
})

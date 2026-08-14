// @vitest-environment happy-dom

import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('~/components/Table/Table', () => ({
	VirtualTable: ({
		instance
	}: {
		instance: { getRowModel: () => { rows: Array<{ id: string; depth: number; original: { name: string } }> } }
	}) => (
		<div data-testid="protocol-rankings-table">
			{instance.getRowModel().rows.map((row) => (
				<div key={row.id} data-row-name={row.original.name} data-row-depth={row.depth} />
			))}
		</div>
	)
}))

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
	availableActivityMetrics: []
} satisfies ProtocolRankingInitialPage

const responsePage = {
	...initialPage,
	rows: [protocol]
} satisfies ProtocolRankingPage<IProtocol>

let rankingResponse: ProtocolRankingPage<IProtocol> = responsePage

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

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		router.query = {}
		router.push.mockReset().mockImplementation(async ({ query }) => {
			router.query = query as Record<string, string>
			return true
		})
		router.replace.mockReset()
		rankingResponse = responsePage
		toastError.mockReset()
		triggerIntersection = null
		localStorage.clear()
		localStorage.setItem('ptcmp', 'Fees')
		localStorage.setItem('ptcp', '7d')
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: true, status: 200, json: async () => rankingResponse }) as Response)
		)
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(callback: IntersectionObserverCallback) {
					triggerIntersection = () =>
						callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
				}
				observe() {}
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

	it('hydrates the static TVL page before reconciling persisted client presets', async () => {
		await hydrateTable()

		const hydrationErrors = consoleError.mock.calls.filter((call: unknown[]) =>
			String(call[0]).toLowerCase().includes('hydration')
		)
		expect(hydrationErrors).toEqual([])
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
	})

	it('does not toast when an automatic persisted-preset request fails', async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response)

		await hydrateTable()
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

		expect(toastError).not.toHaveBeenCalled()
	})

	it('toasts when a user search request fails', async () => {
		localStorage.clear()
		vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response)
		await hydrateTable()
		const search = container.querySelector<HTMLInputElement>('input[type="search"]')
		if (!search) throw new Error('Expected protocol search input')

		await act(async () => {
			const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
			if (!setInputValue) throw new Error('Expected native input value setter')
			setInputValue.call(search, 'aave')
			search.dispatchEvent(new InputEvent('input', { bubbles: true }))
			await new Promise((resolve) => setTimeout(resolve, 275))
			await Promise.resolve()
		})

		expect(toastError).toHaveBeenCalledWith("Couldn't update rankings. Please retry.", {
			id: 'protocol-rankings-update-error'
		})
	})

	it('covers stale rows while a replacement request is pending', async () => {
		localStorage.clear()
		let resolveRequest: ((response: Response) => void) | undefined
		vi.mocked(fetch).mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveRequest = resolve
				})
		)
		await hydrateTable()
		const search = container.querySelector<HTMLInputElement>('input[type="search"]')
		if (!search) throw new Error('Expected protocol search input')

		await act(async () => {
			const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
			if (!setInputValue) throw new Error('Expected native input value setter')
			setInputValue.call(search, 'aave')
			search.dispatchEvent(new InputEvent('input', { bubbles: true }))
			await new Promise((resolve) => setTimeout(resolve, 275))
			await Promise.resolve()
		})

		expect(container.textContent).toContain('Updating rankings…')

		await act(async () => {
			resolveRequest?.({ ok: true, status: 200, json: async () => responsePage } as Response)
			await Promise.resolve()
		})
		expect(container.textContent).not.toContain('Updating rankings…')
	})

	it('keeps infinite-scroll loading in the footer without an overlay', async () => {
		localStorage.clear()
		const paginatedPage = { ...initialPage, nextCursor: 'next', total: 2, hasMore: true }
		vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => undefined))
		await hydrateTable(paginatedPage)
		if (!triggerIntersection) throw new Error('Expected protocol rankings scroll observer')

		act(() => triggerIntersection?.())
		await vi.waitFor(() => expect(container.textContent).toContain('Loading more protocols… 1 of 2'))

		expect(container.textContent).not.toContain('Updating rankings…')
	})

	it('clears persisted ranking state and requests the default page on Reset', async () => {
		router.query = { minTvl: '100' }
		localStorage.setItem('ptcfs', 'Fees')
		localStorage.setItem('ptc', JSON.stringify({ fees_7d: true }))
		await hydrateTable()
		const requestsBeforeReset = vi.mocked(fetch).mock.calls.length
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
		expect(fetch).toHaveBeenCalledTimes(requestsBeforeReset + 1)
		expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('sort=tvl')
		expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).not.toContain('minTvl')
	})

	it('automatically expands a parent whose child name matches search', async () => {
		localStorage.clear()
		const matchingChild = { ...protocol, id: 'stable-child', name: 'Stable Child', slug: 'stable-child' }
		const parent = {
			...protocol,
			id: 'parent',
			name: 'Unrelated Parent',
			slug: 'parent',
			childProtocols: [matchingChild]
		}
		rankingResponse = { ...responsePage, rows: [parent] }
		await hydrateTable()
		const search = container.querySelector<HTMLInputElement>('input[type="search"]')
		if (!search) throw new Error('Expected protocol search input')

		await act(async () => {
			const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
			if (!setInputValue) throw new Error('Expected native input value setter')
			setInputValue.call(search, 'stab')
			search.dispatchEvent(new InputEvent('input', { bubbles: true }))
			await new Promise((resolve) => setTimeout(resolve, 275))
			await Promise.resolve()
		})

		expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('search=stab')
		expect(container.querySelector('[data-row-name="Unrelated Parent"][data-row-depth="0"]')).not.toBeNull()
		expect(container.querySelector('[data-row-name="Stable Child"][data-row-depth="1"]')).not.toBeNull()
	})
})

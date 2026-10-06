// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import {
	protocolListRequestQuery,
	protocolListSort,
	protocolListSortQuery,
	type ProtocolListInitialProps,
	type ProtocolListQuery
} from '../tableQuery'

const state = vi.hoisted(() => ({ query: {} as ProtocolListQuery, push: vi.fn() }))
vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/recent', query: state.query, push: state.push, isReady: true })
}))
// Heavy toolbar controls this suite never uses.
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('~/components/Filters/TVLRange', () => ({ TVLRange: () => null }))
vi.mock('~/components/CsvDownloadButton', () => ({ CSVDownloadButton: () => null }))
import { RecentlyListedProtocolsTable } from '../RecentProtocolsTable'

const http = installFixtureFetch()

describe('protocol list request query', () => {
	test('falls back to newest listings for unknown sorts and treats any non-asc order as descending', () => {
		expect(protocolListSort({ sort: 'tvl', order: 'asc' })).toEqual({ id: 'tvl', desc: false })
		expect(protocolListSort({ sort: 'unsupported', order: 'up' })).toEqual({ id: 'listedAt', desc: true })
		expect(protocolListSortQuery([{ id: 'tvl', desc: false }])).toEqual({ sort: 'tvl', order: 'asc' })
		expect(protocolListSortQuery([])).toEqual({ sort: 'listedAt', order: 'desc' })
	})

	test('sends URL filters, the debounced search, and only additive TVL settings that are enabled', () => {
		expect(
			protocolListRequestQuery(
				{ chain: 'Base', category: '', search: 'Nee', sort: 'tvl', order: 'asc', unrelated: 'x' },
				{ staking: true, doublecounted: true, pool2: false },
				'Needle'
			)
		).toEqual({ chain: 'Base', category: '', search: 'Needle', sort: 'tvl', order: 'asc', tvlKeys: ['staking'] })
		expect(protocolListRequestQuery({}, {}, '')).toEqual({})
	})
})

const protocol = {
	defillamaId: 'new',
	name: 'Newest',
	listedAt: 3,
	category: 'Lending',
	chains: ['Ethereum'],
	symbol: '-',
	logo: null,
	url: '',
	chainTvls: {},
	extraTvl: {},
	tvl: 50,
	tvlPrevDay: 50,
	tvlPrevWeek: 50,
	tvlPrevMonth: 50,
	mcap: null,
	mcaptvl: null,
	change_1d: 0,
	change_7d: 0,
	change_1m: 0
}
const props: ProtocolListInitialProps = {
	kind: 'recent',
	protocols: [protocol],
	chainList: ['Ethereum', 'Base'],
	categories: ['Lending'],
	protocolList: { version: 'abcdefghijklmnopqrst', nextCursor: 'next', total: 2, hasMore: true }
}

describe('RecentlyListedProtocolsTable', () => {
	let container: HTMLDivElement
	let root: Root
	let pending: Array<(value: Response) => void>
	let observers: Array<IntersectionObserverCallback>
	let client: QueryClient
	beforeEach(() => {
		state.query = {}
		state.push.mockReset()
		pending = []
		// Each page request waits until the test answers it with resolvePage.
		http.serve({ '/api/public/protocol-lists': () => new Promise<Response>((resolve) => pending.push(resolve)) })
		observers = []
		client = new QueryClient()
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(callback: IntersectionObserverCallback) {
					observers.push(callback)
				}
				observe() {}
				unobserve() {}
				disconnect() {}
				takeRecords() {
					return []
				}
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

	const requestedUrl = () => http.requests.at(-1)!.url
	// The page's data function stamps the clock its listed-at labels are measured from.
	const table = () => (
		<PageClockProvider pageClockSec={1_790_000_000}>
			<QueryClientProvider client={client}>
				<RecentlyListedProtocolsTable {...props} />
			</QueryClientProvider>
		</PageClockProvider>
	)
	async function hydrate() {
		container.innerHTML = renderToString(table())
		await act(async () => {
			root = hydrateRoot(container, table())
		})
	}
	async function resolvePage(names: Array<string>, nextCursor: string | null = null) {
		await act(async () => {
			pending.shift()!(
				Response.json({
					...props.protocolList,
					rows: names.map((name) => ({ ...protocol, defillamaId: name, name })),
					nextCursor,
					hasMore: nextCursor !== null
				})
			)
		})
	}

	test('hydrates SSR rows without a fetch, appends a pinned page, and retains rows when a filter fails', async () => {
		await hydrate()
		expect(container.textContent).toContain('Newest')
		expect(http.requests).toEqual([])
		// Scrolling to the end of the list brings the load-more sentinel into view.
		await act(async () => {
			for (const callback of observers)
				callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
		})
		expect(requestedUrl().searchParams.get('snapshot')).toBe('abcdefghijklmnopqrst')
		expect(requestedUrl().searchParams.get('cursor')).toBe('next')
		await resolvePage(['Older'])
		expect(container.textContent).toContain('Older')

		state.query = { chain: 'Base' }
		await act(async () => root.render(table()))
		expect(requestedUrl().searchParams.get('chain')).toBe('Base')
		await act(async () => pending.shift()!(new Response('', { status: 500 })))
		expect(container.textContent).toContain("Couldn't update results.")
		expect(container.textContent).toContain('Newest')
		expect(container.textContent).toContain('Older')
		const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')!
		await act(async () => retry.click())
		await resolvePage(['Base Match'])
		expect(container.textContent).toContain('Base Match')
		expect(container.textContent).not.toContain('Older')
	})

	test('a header sort persists to the URL and the server page replaces the current rows', async () => {
		await hydrate()
		const tvlHeader = Array.from(container.querySelectorAll('th button')).find(
			(button) => button.textContent?.trim() === 'TVL'
		) as HTMLButtonElement
		await act(async () => tvlHeader.click())
		expect(state.push.mock.calls[0]?.[0].query).toMatchObject({ sort: 'tvl' })
		state.query = { sort: 'tvl', order: 'asc' }
		await act(async () => root.render(table()))
		expect(container.textContent).toContain('Newest')
		await resolvePage(['Smallest'])
		expect(container.textContent).toContain('Smallest')
		expect(container.textContent).not.toContain('Newest')
	})
})

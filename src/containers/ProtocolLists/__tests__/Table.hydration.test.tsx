// @vitest-environment happy-dom
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ProtocolListInitialProps, ProtocolListQuery } from '../tableQuery'

const state = vi.hoisted(() => ({ query: {} as ProtocolListQuery, push: vi.fn(), settings: {} }))
vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/recent', query: state.query, push: state.push, isReady: true })
}))
vi.mock('~/contexts/LocalStorage', () => ({ useLocalStorageSettingsManager: () => [state.settings] }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('~/components/Filters/TVLRange', () => ({ TVLRange: () => null }))
vi.mock('~/components/CsvDownloadButton', () => ({
	CSVDownloadButton: ({ onClick }: { onClick: () => void }) => (
		<button type="button" onClick={onClick}>
			Export
		</button>
	)
}))
vi.mock('~/components/Table/VirtualTable', () => ({
	VirtualTable: ({
		table
	}: {
		table: {
			getRowModel: () => { rows: Array<{ original: { name: string } }> }
			getColumn: (id: string) => { toggleSorting: (desc: boolean) => void }
		}
	}) => (
		<div>
			<button type="button" onClick={() => table.getColumn('tvl').toggleSorting(false)}>
				Sort TVL ascending
			</button>
			{table.getRowModel().rows.map((row) => (
				<div data-row={row.original.name} key={row.original.name}>
					{row.original.name}
				</div>
			))}
		</div>
	)
}))
import { RecentlyListedProtocolsTable } from '../RecentProtocolsTable'

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
let container: HTMLDivElement
let root: Root
let pending: Array<(value: Response) => void>
let observer: IntersectionObserverCallback
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	state.query = {}
	state.settings = {}
	state.push.mockReset()
	pending = []
	vi.stubGlobal(
		'fetch',
		vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)))
	)
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: IntersectionObserverCallback) {
				observer = callback
			}
			observe() {}
			disconnect() {}
		}
	)
	container = document.createElement('div')
	document.body.appendChild(container)
})
afterEach(async () => {
	if (root) await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
})
async function hydrate() {
	container.innerHTML = renderToString(<RecentlyListedProtocolsTable {...props} />)
	expect(container.querySelector('[data-row]')?.textContent).toBe('Newest')
	await act(async () => {
		root = hydrateRoot(container, <RecentlyListedProtocolsTable {...props} />)
	})
}
async function resolvePage(names: Array<string>, nextCursor: string | null = null) {
	await act(async () => {
		pending.shift()!(
			new Response(
				JSON.stringify({
					...props.protocolList,
					rows: names.map((name) => ({ ...protocol, defillamaId: name, name })),
					nextCursor,
					hasMore: nextCursor !== null
				})
			)
		)
	})
}
test('hydrates SSR rows without a full-data fetch, appends a pinned page, and retains rows on failure', async () => {
	await hydrate()
	expect(fetch).not.toHaveBeenCalled()
	await act(async () => observer([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
	expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('snapshot=abcdefghijklmnopqrst&cursor=next')
	await resolvePage(['Older'])
	expect(Array.from(container.querySelectorAll('[data-row]'), (el) => el.textContent)).toEqual(['Newest', 'Older'])
	state.query = { chain: 'Base', excludeCategory: 'Dexs', hideForks: 'true', maxTvl: '20', sort: 'tvl', order: 'asc' }
	await act(async () => root.render(<RecentlyListedProtocolsTable {...props} />))
	const url = new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost')
	expect([
		url.searchParams.get('chain'),
		url.searchParams.get('excludeCategory'),
		url.searchParams.get('hideForks'),
		url.searchParams.get('maxTvl'),
		url.searchParams.get('sort'),
		url.searchParams.get('order')
	]).toEqual(['Base', 'Dexs', 'true', '20', 'tvl', 'asc'])
	await act(async () => pending.shift()!(new Response('', { status: 500 })))
	expect(container.textContent).toContain("Couldn't update results.")
	expect(Array.from(container.querySelectorAll('[data-row]'), (el) => el.textContent)).toEqual(['Newest', 'Older'])
	const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')!
	await act(async () => retry.click())
	await resolvePage(['Base Match'])
	expect(Array.from(container.querySelectorAll('[data-row]'), (el) => el.textContent)).toEqual(['Base Match'])
})
test('sort controls persist URL state and server results replace the current page', async () => {
	await hydrate()
	await act(async () =>
		Array.from(container.querySelectorAll('button'))
			.find((button) => button.textContent === 'Sort TVL ascending')!
			.click()
	)
	expect(state.push.mock.calls[0]?.[0].query).toEqual({ sort: 'tvl', order: 'asc' })
	state.query = { sort: 'tvl', order: 'asc' }
	await act(async () => root.render(<RecentlyListedProtocolsTable {...props} />))
	expect(container.querySelector('[data-row]')?.textContent).toBe('Newest')
	await resolvePage(['Smallest'])
	expect(container.querySelector('[data-row]')?.textContent).toBe('Smallest')
})
test('URL search and TVL settings request filtered pages and export the same pinned query', async () => {
	await hydrate()
	state.query = { search: 'Needle', category: '' }
	state.settings = { staking: true, doublecounted: true }
	await act(async () => root.render(<RecentlyListedProtocolsTable {...props} />))
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 280))
	})
	const pageUrl = new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost')
	expect([
		pageUrl.searchParams.get('search'),
		pageUrl.searchParams.get('category'),
		pageUrl.searchParams.getAll('tvlKeys')
	]).toEqual(['Needle', '', ['staking']])
	await resolvePage([]) // Superseded request before the search debounce.
	await resolvePage([])
	expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv')
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
	await act(async () =>
		Array.from(container.querySelectorAll('button'))
			.find((button) => button.textContent === 'Export')!
			.click()
	)
	const exportUrl = new URL(String(vi.mocked(fetch).mock.calls.at(-1)?.[0]), 'http://localhost')
	expect([
		exportUrl.searchParams.get('csv'),
		exportUrl.searchParams.get('search'),
		exportUrl.searchParams.get('snapshot'),
		exportUrl.searchParams.get('cursor')
	]).toEqual(['true', 'Needle', 'abcdefghijklmnopqrst', null])
	await act(async () => pending.shift()!(new Response('Name\nNeedle')))
})

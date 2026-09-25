// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Storage } from 'happy-dom'
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime'
import type { NextRouter } from 'next/router'
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import ProtocolPage from '~/pages/protocol/yields/[protocol]'
import { APY_COMPONENTS_PREF, APY_WINDOW_PREF, TABLE_PAGE_SIZE_PREF } from '../stickyQueryPrefs'

const mocks = vi.hoisted(() => ({
	router: {
		pathname: '/protocol/yields/[protocol]',
		asPath: '/protocol/yields/aave',
		query: { protocol: 'aave' } as Record<string, string | Array<string> | undefined>,
		isReady: true,
		push: vi.fn().mockResolvedValue(true),
		replace: vi.fn().mockResolvedValue(true),
		events: { on: vi.fn(), off: vi.fn() }
	},
	fetchJson: vi.fn()
}))
vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: mocks.fetchJson
}))
// Heavy children this test asserts nothing about.
vi.mock('~/containers/ProtocolOverview/Layout', () => ({
	ProtocolOverviewLayout: ({ children }: { children: ReactNode }) => children
}))
vi.mock('~/containers/Yields/Tables/Pools', () => ({
	PaginatedYieldsPoolTable: ({ data }: { data: Array<{ id: string }> }) => (
		<div>{data.map((row) => row.id).join(',')}</div>
	)
}))
vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({ ResponsiveFilterLayout: () => null }))
vi.mock('../Filters/Dropdowns', () => ({ YieldFilterDropdowns: () => null }))
vi.mock('~/components/CsvDownloadButton', () => ({ CSVDownloadButton: () => null }))

const props = {
	name: 'Aave',
	protocolNames: ['Aave V2', 'Aave V3'],
	chainList: ['Ethereum', 'Base'],
	evmChains: ['Ethereum', 'Base'],
	otherProtocols: [],
	warningBanners: [],
	metrics: {},
	category: 'Lending',
	parentProtocol: null,
	seoTitle: 'Aave yields',
	seoDescription: 'Aave yield pools'
} as ComponentProps<typeof ProtocolPage>
let client: QueryClient
let root: Root
let container: HTMLDivElement
const element = (pageProps = props) => (
	<QueryClientProvider client={client}>
		<RouterContext.Provider value={mocks.router as unknown as NextRouter}>
			{/* A signed-out reader. */}
			<AuthProvider>
				<ProtocolPage {...pageProps} />
			</AuthProvider>
		</RouterContext.Provider>
	</QueryClientProvider>
)
const lastRequest = () => new URL(String(mocks.fetchJson.mock.calls.at(-1)?.[0]), 'https://example.com').searchParams
const button = (label: string) =>
	Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.replace('+', '').trim() === label)!

beforeEach(() => {
	vi.stubGlobal('localStorage', new Storage())
	vi.clearAllMocks()
	mocks.router = { ...mocks.router, query: { protocol: 'aave', chain: 'Ethereum', page: '3' } }
	mocks.fetchJson.mockResolvedValue({ rows: [{ id: 'aave-pool' }], total: 1, page: 1, pageSize: 100, hasMore: false })
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.unstubAllGlobals()
})

test('restores APY preferences before fetching and keeps protocol scope when toggling and clearing', async () => {
	localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
	localStorage.setItem(APY_COMPONENTS_PREF.storageKey, 'intrinsic')
	localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '100')
	const html = renderToString(element())
	expect(html).toContain('Loading APY preferences')
	expect(html).not.toContain('aria-label="APY window"')
	await act(async () => root.unmount())
	container.innerHTML = html
	const onRecoverableError = vi.fn()
	await act(async () => {
		root = hydrateRoot(container, element(), { onRecoverableError })
	})
	expect(onRecoverableError).not.toHaveBeenCalled()
	expect(mocks.fetchJson).not.toHaveBeenCalled()
	expect(mocks.router.replace).toHaveBeenCalledTimes(1)
	const restored = mocks.router.replace.mock.calls[0][0].query
	expect(restored).toMatchObject({
		protocol: 'aave',
		apyWindow: 'avg_30d',
		apyComponents: 'intrinsic',
		pageSize: '100'
	})
	mocks.router = { ...mocks.router, query: restored }
	await act(async () => root.render(element()))
	await vi.waitFor(() => expect(container.textContent).toContain('aave-pool'))
	expect(lastRequest().getAll('protocol')).toEqual(['Aave V2', 'Aave V3'])
	expect(lastRequest().get('apyWindow')).toBe('avg_30d')
	expect(lastRequest().get('apyComponents')).toBe('intrinsic')
	expect(lastRequest().get('pageSize')).toBe('100')
	expect(button('Intrinsic').getAttribute('aria-pressed')).toBe('true')
	expect(button('Reward').getAttribute('aria-pressed')).toBe('false')
	expect(container.querySelector('input[value="avg_30d"]')?.getAttribute('aria-checked')).toBe('true')

	await act(async () => button('Reward').click())
	const changed = mocks.router.push.mock.calls.at(-1)![0]
	expect(changed.pathname).toBe('/protocol/yields/aave')
	expect(changed.query).toEqual({
		chain: 'Ethereum',
		apyWindow: 'avg_30d',
		apyComponents: 'reward,intrinsic',
		pageSize: '100'
	})
	mocks.router = { ...mocks.router, query: { protocol: 'aave', ...changed.query } }
	await act(async () => root.render(element()))
	expect(lastRequest().getAll('protocol')).toEqual(['Aave V2', 'Aave V3'])
	expect(lastRequest().get('apyComponents')).toBe('reward,intrinsic')
	expect(lastRequest().get('page')).toBe('1')

	await act(async () => button('Clear filters').click())
	const cleared = mocks.router.push.mock.calls.at(-1)![0]
	expect(cleared).toEqual({
		pathname: '/protocol/yields/aave',
		query: { apyWindow: 'avg_30d', apyComponents: 'reward,intrinsic', pageSize: '100' }
	})
	mocks.router = { ...mocks.router, query: { protocol: 'aave', ...cleared.query } }
	await act(async () => root.render(element()))
	expect(lastRequest().getAll('protocol')).toEqual(['Aave V2', 'Aave V3'])
	expect(lastRequest().get('chain')).toBeNull()
	expect(button('Clear filters').disabled).toBe(true)
	expect(mocks.router.replace).toHaveBeenCalledTimes(1)
})

test('does not fetch or restore preferences for a protocol without yield pools', async () => {
	localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
	await act(async () => root.render(element({ ...props, protocolNames: [] })))
	expect(container.textContent).toBe('No yield pools for this protocol')
	expect(mocks.fetchJson).not.toHaveBeenCalled()
	expect(mocks.router.replace).not.toHaveBeenCalled()
})

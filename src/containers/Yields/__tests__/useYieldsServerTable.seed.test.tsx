// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Storage } from 'happy-dom'
import { act, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { YieldsPaginatedTableResponse } from '../yieldsTableQuery'

const routerMock = vi.hoisted(() => ({
	events: { on: vi.fn(), off: vi.fn() },
	isReady: true,
	query: {} as Record<string, string | Array<string> | undefined>,
	push: vi.fn(),
	replace: vi.fn(),
	pathname: '/yields'
}))
vi.mock('next/router', () => ({ useRouter: () => routerMock }))

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson }))

import { ApyViewControls } from '../Filters/ApyViewControls'
import { APY_COMPONENTS_PREF, APY_WINDOW_PREF, TABLE_PAGE_SIZE_PREF } from '../stickyQueryPrefs'
import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'
import { useYieldsServerTable } from '../useYieldsServerTable'

// A signed-out reader, through the real auth provider.
function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
	return (
		<QueryClientProvider client={client}>
			<AuthProvider>{children}</AuthProvider>
		</QueryClientProvider>
	)
}

type Row = { id: string; tvl: number }

const initialData: YieldsPaginatedTableResponse<Row> = {
	rows: [
		{ id: 'seeded-1', tvl: 100 },
		{ id: 'seeded-2', tvl: 50 }
	],
	total: 2,
	page: 1,
	pageSize: 50,
	hasMore: false,
	medianApy: 4.2
}

type HookResult = ReturnType<typeof useYieldsServerTable<Row>>

function Harness({ onRender }: { onRender: (result: HookResult) => void }) {
	onRender(
		useYieldsServerTable<Row>({
			endpoint: '/api/public/yields/earn',
			initialSeed: { initialData, initialDataUpdatedAt: Date.now() }
		})
	)
	return null
}

function StickyHarness({ onRender }: { onRender: (result: HookResult) => void }) {
	const enabled = useLegacyYieldsUrlNormalizer({ page: 'earn', tokens: [] })
	const result = useYieldsServerTable<Row>({
		endpoint: '/api/public/yields/earn',
		enabled,
		initialSeed: { initialData, initialDataUpdatedAt: Date.now() }
	})
	onRender(result)
	return (
		<>
			<ApyViewControls ready={enabled} />
			<span>{result.isLoading ? 'Loading pools' : result.rows.map((row) => row.id).join(',')}</span>
		</>
	)
}

describe('useYieldsServerTable ISR seed', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult

	const render = async (sticky = false) => {
		const Component = sticky ? StickyHarness : Harness
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		await act(async () => {
			root.render(
				<Providers client={client}>
					<Component onRender={(result) => (latest = result)} />
				</Providers>
			)
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		fetchJson.mockReset()
		vi.stubGlobal('localStorage', new Storage())
		routerMock.replace.mockReset().mockResolvedValue(true)
		routerMock.push.mockReset().mockResolvedValue(true)
		routerMock.query = {}
		routerMock.isReady = true
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	test.each([
		{ current: undefined, toggle: 'Reward', expected: 'base' },
		{ current: undefined, toggle: 'Intrinsic', expected: 'reward,intrinsic' },
		{ current: 'base', toggle: 'Reward', expected: undefined },
		{ current: 'base', toggle: 'Intrinsic', expected: 'intrinsic' },
		{ current: 'intrinsic', toggle: 'Reward', expected: 'reward,intrinsic' },
		{ current: 'intrinsic', toggle: 'Intrinsic', expected: 'base' },
		{ current: 'reward,intrinsic', toggle: 'Reward', expected: 'intrinsic' },
		{ current: 'reward,intrinsic', toggle: 'Intrinsic', expected: undefined }
	])('toggles $toggle from $current and remembers $expected', async ({ current, toggle, expected }) => {
		routerMock.query = current ? { apyComponents: current } : {}
		if (current) localStorage.setItem(APY_COMPONENTS_PREF.storageKey, current)
		await act(async () => root.render(<ApyViewControls />))
		const button = Array.from(container.querySelectorAll('button')).find((button) =>
			button.textContent?.includes(toggle)
		)!
		await act(async () => button.click())
		expect(routerMock.push).toHaveBeenCalledWith(
			{ pathname: '/yields', query: expected ? { apyComponents: expected } : {} },
			undefined,
			{ shallow: true }
		)
		expect(localStorage.getItem(APY_COMPONENTS_PREF.storageKey)).toBe(expected ?? null)
	})

	test.each([true, false])('hydrates without flashing default controls or seeded rows (saved: %s)', async (saved) => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const renders: Array<HookResult> = []
		const element = () => (
			<Providers client={client}>
				<StickyHarness onRender={(value) => renders.push(value)} />
			</Providers>
		)
		const html = renderToString(element())
		expect(html).toContain('Loading pools')
		expect(html).toContain('Loading APY preferences')
		expect(html).not.toContain('seeded-1')
		expect(html).not.toContain('role="radio"')
		if (saved) window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		await act(async () => root.unmount())
		container.innerHTML = html
		const onRecoverableError = vi.fn()
		await act(async () => {
			root = hydrateRoot(container, element(), { onRecoverableError })
		})
		expect(onRecoverableError).not.toHaveBeenCalled()
		expect(fetchJson).not.toHaveBeenCalled()
		expect(renders.every((value) => value.rows.length === 0)).toBe(saved)
		expect(container.textContent.includes('Loading pools')).toBe(saved)
		if (saved) {
			fetchJson.mockResolvedValue({ ...initialData, rows: [{ id: 'saved-pool', tvl: 42 }] })
			routerMock.query = { apyWindow: 'avg_30d' }
			await act(async () => root.render(element()))
		}
		await waitForUi(async () => {
			await act(async () => {})
			expect(container.textContent).toContain(saved ? 'saved-pool' : 'seeded-1')
		})
		expect(renders.some((value) => value.rows.some((row) => row.id === 'seeded-1'))).toBe(!saved)
		client.clear()
	})

	test('restores a canceled preference navigation before fetching the matching rows', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		routerMock.replace.mockResolvedValueOnce(false)
		fetchJson.mockResolvedValue({ ...initialData, rows: [{ id: '30d-pool', tvl: 42 }] })
		await render(true)
		expect(routerMock.replace).toHaveBeenCalledTimes(2)
		expect(fetchJson).not.toHaveBeenCalled()
		expect(latest.isLoading).toBe(true)

		routerMock.query = { apyWindow: 'avg_30d' }
		await render(true)
		await waitForUi(async () => {
			await act(async () => {})
			expect(latest.rows[0]?.id).toBe('30d-pool')
		})
		expect(fetchJson).toHaveBeenCalledTimes(1)
		expect(String(fetchJson.mock.calls[0]?.[0])).toContain('apyWindow=avg_30d')
		expect(latest.isLoading).toBe(false)
	})

	test('only saves the row count when the size changes, not when changing pages', async () => {
		window.localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '100')
		await render()
		await act(async () => latest.tableProps.onPaginationChange?.({ pageIndex: 1, pageSize: 50 }))
		expect(window.localStorage.getItem(TABLE_PAGE_SIZE_PREF.storageKey)).toBe('100')
		await act(async () => latest.tableProps.onPaginationChange?.({ pageIndex: 0, pageSize: 200 }))
		expect(window.localStorage.getItem(TABLE_PAGE_SIZE_PREF.storageKey)).toBe('200')
	})

	test('preserves an explicit default size when paging with a different saved size', async () => {
		window.localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '100')
		routerMock.query = { pageSize: '50' }
		fetchJson.mockImplementation(() => new Promise(() => {}))
		await render(true)
		await act(async () => latest.tableProps.onPaginationChange?.({ pageIndex: 1, pageSize: 50 }))
		const pushed = routerMock.push.mock.calls[0][0].query
		expect(pushed).toEqual({ page: '2', pageSize: '50' })
		routerMock.query = pushed
		await render(true)
		expect(routerMock.replace).not.toHaveBeenCalled()
		expect(window.localStorage.getItem(TABLE_PAGE_SIZE_PREF.storageKey)).toBe('100')
	})

	test('keeps default URLs clean when paging or selecting the default size', async () => {
		await render()
		await act(async () => latest.tableProps.onPaginationChange?.({ pageIndex: 1, pageSize: 50 }))
		expect(routerMock.push.mock.calls[0][0].query).toEqual({ page: '2' })
		window.localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '100')
		routerMock.query = { pageSize: '100' }
		fetchJson.mockImplementation(() => new Promise(() => {}))
		await render(true)
		await act(async () => latest.tableProps.onPaginationChange?.({ pageIndex: 0, pageSize: 50 }))
		expect(routerMock.push.mock.calls[1][0].query).toEqual({})
		expect(window.localStorage.getItem(TABLE_PAGE_SIZE_PREF.storageKey)).toBeNull()
		routerMock.query = {}
		await render(true)
		expect(routerMock.replace).not.toHaveBeenCalled()
	})

	test('renders the seeded default view without fetching', async () => {
		await render()

		expect(latest.rows.map((row) => row.id)).toEqual(['seeded-1', 'seeded-2'])
		expect(latest.data).toBe(initialData)
		expect(latest.total).toBe(2)
		expect(latest.medianApy).toBe(4.2)
		expect(latest.isLoading).toBe(false)
		expect(fetchJson).not.toHaveBeenCalled()
	})

	test('never shows seeded rows under a filtered URL - loading, then fresh data', async () => {
		routerMock.query = { minApy: '5' }
		let resolve: (value: YieldsPaginatedTableResponse<Row>) => void = () => {}
		fetchJson.mockImplementation(() => new Promise((r) => (resolve = r)))

		await render()

		expect(fetchJson).toHaveBeenCalledTimes(1)
		expect(String(fetchJson.mock.calls[0]?.[0])).toContain('minApy=5')
		// The URL claims filters the seed does not represent.
		expect(latest.rows).toEqual([])
		expect(latest.isLoading).toBe(true)
		expect(latest.rowsQuery.isFetching).toBe(true)

		await act(async () => {
			resolve({ rows: [{ id: 'filtered', tvl: 10 }], total: 1, page: 1, pageSize: 50, hasMore: false })
		})
		await waitForUi(async () => {
			await act(async () => {})
			expect(latest.rows.map((row) => row.id)).toEqual(['filtered'])
		})
		expect(latest.isLoading).toBe(false)
		expect(latest.rowsQuery.isFetching).toBe(false)
	})

	test('drops the seed when a parameterized fetch fails instead of showing unfiltered rows', async () => {
		routerMock.query = { minApy: '5' }
		fetchJson.mockRejectedValue(new Error('upstream down'))

		// The query retries once after a one-second backoff before erroring; the clock skips it.
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		try {
			await render()
			expect(latest.rows).toEqual([])
			for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(1000))
		} finally {
			vi.useRealTimers()
		}

		expect(latest.rowsQuery.isError).toBe(true)
		expect(latest.rows).toEqual([])
		expect(latest.total).toBe(0)
		// Errors surface through rowsQuery.isError, not the loading state.
		expect(latest.isLoading).toBe(false)
	})

	test('leaves interaction enabled while the seeded page refreshes in the background', async () => {
		fetchJson.mockImplementation(() => new Promise(() => {}))
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		function StaleHarness() {
			latest = useYieldsServerTable<Row>({
				endpoint: '/api/public/yields/earn',
				initialSeed: { initialData, initialDataUpdatedAt: Date.now() - 10 * 60_000 }
			})
			return null
		}
		await act(async () => {
			root.render(
				<Providers client={client}>
					<StaleHarness />
				</Providers>
			)
		})

		// The server never fetches, so a mount-time refresh must not draw the overlay the server lacks.
		expect(latest.rowsQuery.isFetching).toBe(true)
		expect(latest.tableProps.interactionDisabled).toBe(false)
		expect(latest.rows.map((row) => row.id)).toEqual(['seeded-1', 'seeded-2'])
	})

	test('renders seeded rows before the router is ready, still without fetching', async () => {
		routerMock.isReady = false

		await render()

		expect(latest.rows.map((row) => row.id)).toEqual(['seeded-1', 'seeded-2'])
		// SSR never sees a ready router, so the page must resolve here and the loader must not show,
		// or the seeded rows would be stripped from the static HTML.
		expect(latest.data).toBe(initialData)
		expect(latest.isLoading).toBe(false)
		expect(fetchJson).not.toHaveBeenCalled()
	})
})

// Markup that depends on the hook's hydration-sensitive outputs: the loading overlay
// (interactionDisabled), the seeded rows, and the views' loading panel.
function HydrationHarness({ initialDataUpdatedAt }: { initialDataUpdatedAt: number }) {
	const result = useYieldsServerTable<Row>({
		endpoint: '/api/public/yields/earn',
		initialSeed: { initialData, initialDataUpdatedAt }
	})
	return (
		<span>{`${String(result.tableProps.interactionDisabled)}:${result.rows.length}:${String(result.isLoading)}`}</span>
	)
}

describe('useYieldsServerTable hydration', () => {
	afterEach(() => {
		routerMock.isReady = true
		routerMock.query = {}
	})

	test('a stale seed on a bare URL hydrates without fetching, then refreshes in the background', async () => {
		// Older than the query's staleTime, so the client would refetch on mount.
		const staleAt = Date.now() - 10 * 60 * 1000
		fetchJson.mockReset()
		fetchJson.mockImplementation(() => new Promise(() => {}))
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const element = (
			<Providers client={client}>
				<HydrationHarness initialDataUpdatedAt={staleAt} />
			</Providers>
		)

		// Server pass: router not ready, query disabled, seeded rows in the HTML.
		routerMock.isReady = false
		routerMock.query = {}
		const html = renderToString(element)
		expect(html).toContain('false:2:false')
		expect(fetchJson).not.toHaveBeenCalled()

		// Client: a static page at a bare URL is already ready on its first render. That pass
		// must still match the server, and only afterwards may the stale seed start its background
		// refresh. The seeded rows are the page being refreshed, not a stand-in for another, so the
		// table stays live rather than disabled while it runs.
		routerMock.isReady = true
		const container = document.createElement('div')
		document.body.appendChild(container)
		container.innerHTML = html
		const onRecoverableError = vi.fn()
		let root: Root | null = null
		await act(async () => {
			root = hydrateRoot(container, element, { onRecoverableError })
		})
		expect(onRecoverableError).not.toHaveBeenCalled()

		await waitForUi(async () => {
			await act(async () => {})
			expect(fetchJson).toHaveBeenCalledTimes(1)
		})
		expect(container.textContent).toBe('false:2:false')

		await act(async () => root?.unmount())
		container.remove()
	})
})

// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { YieldsPaginatedTableResponse } from '../yieldsTableQuery'

const routerMock = vi.hoisted(() => ({
	isReady: true,
	query: {} as Record<string, string | string[] | undefined>,
	push: vi.fn(),
	replace: vi.fn(),
	pathname: '/yields'
}))
vi.mock('next/router', () => ({ useRouter: () => routerMock }))

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson }))

import { useYieldsServerTable } from '../useYieldsServerTable'

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

describe('useYieldsServerTable ISR seed', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult

	const render = async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		await act(async () => {
			root.render(
				<QueryClientProvider client={client}>
					<Harness onRender={(result) => (latest = result)} />
				</QueryClientProvider>
			)
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		fetchJson.mockReset()
		routerMock.query = {}
		routerMock.isReady = true
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('renders the seeded default view without fetching', async () => {
		await render()

		expect(latest.rows.map((row) => row.id)).toEqual(['seeded-1', 'seeded-2'])
		expect(latest.total).toBe(2)
		expect(latest.medianApy).toBe(4.2)
		expect(fetchJson).not.toHaveBeenCalled()
	})

	it('never shows seeded rows under a filtered URL - loading, then fresh data', async () => {
		routerMock.query = { minApy: '5' }
		let resolve: (value: YieldsPaginatedTableResponse<Row>) => void = () => {}
		fetchJson.mockImplementation(() => new Promise((r) => (resolve = r)))

		await render()

		expect(fetchJson).toHaveBeenCalledTimes(1)
		expect(String(fetchJson.mock.calls[0]?.[0])).toContain('minApy=5')
		// The URL claims filters the seed does not represent.
		expect(latest.rows).toEqual([])
		expect(latest.rowsQuery.isFetching).toBe(true)

		await act(async () => {
			resolve({ rows: [{ id: 'filtered', tvl: 10 }], total: 1, page: 1, pageSize: 50, hasMore: false })
		})
		await vi.waitFor(async () => {
			await act(async () => {})
			expect(latest.rows.map((row) => row.id)).toEqual(['filtered'])
		})
		expect(latest.rowsQuery.isFetching).toBe(false)
	})

	it('drops the seed when a parameterized fetch fails instead of showing unfiltered rows', async () => {
		routerMock.query = { minApy: '5' }
		fetchJson.mockRejectedValue(new Error('upstream down'))

		await render()
		// The query retries once with backoff before erroring.
		await vi.waitFor(
			async () => {
				await act(async () => {})
				expect(latest.rowsQuery.isError).toBe(true)
			},
			{ timeout: 5000 }
		)

		expect(latest.rows).toEqual([])
		expect(latest.total).toBe(0)
	})

	it('renders seeded rows before the router is ready, still without fetching', async () => {
		routerMock.isReady = false

		await render()

		expect(latest.rows.map((row) => row.id)).toEqual(['seeded-1', 'seeded-2'])
		expect(fetchJson).not.toHaveBeenCalled()
	})
})

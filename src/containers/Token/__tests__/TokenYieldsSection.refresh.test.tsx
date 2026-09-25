// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { earnPageRow } from '~/utils/test/yieldsEarnFixture'
import { TokenYieldsSection } from '../TokenYieldsSection'
import type { TokenYieldsHydration } from '../types'

const router = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/token/[token]', query: router.query, push: vi.fn() })
}))
// Heavy filter controls the assertions never read.
vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({
	ResponsiveFilterLayout: ({ children }: { children: (nested: boolean) => ReactNode }) => children(false)
}))
vi.mock('~/components/Filters/TVLRange', () => ({ TVLRange: () => null }))
vi.mock('~/containers/Yields/Filters/APYRange', () => ({ APYRange: () => null }))
vi.mock('~/containers/Yields/Filters/Chains', () => ({ FilterByChain: () => null }))
// Render the real pools table eagerly instead of through its lazy chunk.
vi.mock('../deferred/DeferredPaginatedYieldsPoolTable', async () => ({
	DeferredPaginatedYieldsPoolTable: (await import('~/containers/Yields/Tables/Pools')).PaginatedYieldsPoolTable
}))

const http = installFixtureFetch()

// The table shows one pool per page. By the default TVL sort `direct` leads and `held` is second; by APY
// `meme` leads.
const POOLS = [
	earnPageRow('direct', { tvl: 3000, apy: 1 }),
	earnPageRow('held', { tvl: 2000, apy: 2 }),
	earnPageRow('meme', { tvl: 1000, apy: 9 })
]

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	router.query = {}
})

/**
 * Mounts the section for a signed-out reader with one page of hydrated pools and a refresh whose response
 * the caller settles. `filter` hydrates zero pools behind an active filter, which fetches on mount instead
 * of on a click.
 */
async function mountRefresh({ filter }: { filter: boolean }) {
	if (filter) router.query = { minTvl: '0' }
	const hydration: TokenYieldsHydration = {
		rows: filter ? [] : POOLS.slice(0, 1),
		rowCount: POOLS.length,
		chainList: ['Ethereum'],
		pageSize: 1,
		tokenKeys: ['asset:doge']
	}
	const pending = { response: Promise.withResolvers<Response>() }
	http.serve({ '/api/public/yields/earn': () => pending.response.promise })
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	const teardown = async () => {
		pending.response.resolve(Response.json({ rows: [] }))
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	}
	const findButton = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === text)
	const shownPools = () =>
		[...container.querySelectorAll('tbody tr')].map((row) => row.textContent?.match(/direct|held|meme/)?.[0])
	const earnRequests = () => http.requests.filter((request) => request.url.pathname === '/api/public/yields/earn')

	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<TokenYieldsSection hydration={hydration} />
				</AuthProvider>
			</QueryClientProvider>
		)
	)

	return {
		hydration,
		container,
		findButton,
		earnRequests,
		/** Asks for another page or a new sort; hydrated pools alone never fetch. */
		async trigger(kind: 'next-page' | 'sort') {
			expect(earnRequests()).toHaveLength(0)
			const control =
				kind === 'sort'
					? [...container.querySelectorAll<HTMLButtonElement>('thead button')].find((b) => b.textContent === 'APY')
					: container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')
			await act(async () => control!.click())
		},
		awaitRequests: (count: number) => vi.waitFor(() => expect(earnRequests()).toHaveLength(count)),
		/** Replaces the in-flight response, as a retry does. */
		restart() {
			pending.response = Promise.withResolvers<Response>()
		},
		resolve: (rows: Array<IYieldTableRow>) => act(async () => pending.response.resolve(Response.json({ rows }))),
		reject: (message: string) => act(async () => pending.response.reject(new Error(message))),
		shownPools,
		state: () => ({
			pools: shownPools(),
			noPools: container.textContent?.includes('No yield pools found.') ?? false,
			retry: container.textContent?.includes('Retry') ?? false
		}),
		unmount: teardown
	}
}

test('asks the public earn endpoint for the token pools and opens the requested page', async () => {
	const refresh = await mountRefresh({ filter: false })
	try {
		await refresh.trigger('next-page')
		await refresh.awaitRequests(1)
		const params = refresh.earnRequests()[0]!.url.searchParams
		expect([params.getAll('token'), params.get('tokenMatch'), params.get('tokenOn')]).toEqual([
			['asset:doge'],
			'contains',
			'both'
		])
		await refresh.resolve(POOLS)

		await vi.waitFor(async () => {
			await act(async () => {
				expect(refresh.state()).toEqual({ pools: ['held'], noPools: false, retry: false })
			})
		})
	} finally {
		await refresh.unmount()
	}
})

test('shows the empty state when a full-data refresh returns no pools', async () => {
	const refresh = await mountRefresh({ filter: false })
	try {
		await refresh.trigger('next-page')
		await refresh.awaitRequests(1)
		await refresh.resolve([])

		await vi.waitFor(async () => {
			await act(async () => {
				expect(refresh.state()).toEqual({ pools: [], noPools: true, retry: false })
			})
		})
	} finally {
		await refresh.unmount()
	}
})

test.each([
	{ name: 'outage', filter: false, trigger: 'next-page', pools: ['held'] },
	{ name: 'sort-outage', filter: false, trigger: 'sort', pools: ['meme'] },
	{ name: 'no-rows-outage', filter: true, trigger: 'mount', pools: [] }
] as const)('recovers the requested page after a $name and its failed retry', async (scenario) => {
	const refresh = await mountRefresh({ filter: scenario.filter })
	const hydratedPools = refresh.hydration.rows.map((row) => row.id)
	try {
		if (scenario.trigger !== 'mount') await refresh.trigger(scenario.trigger)
		await refresh.awaitRequests(1)

		await refresh.reject('Yields unavailable')
		await vi.waitFor(async () => {
			await act(async () => expect(refresh.container.textContent).toContain('Yields unavailable'))
		})
		// The failed refresh leaves the hydrated selection on screen rather than emptying the table.
		expect(refresh.shownPools()).toEqual(hydratedPools)

		// A retry that fails again keeps that selection and offers Retry once more.
		await retryOnce(refresh, hydratedPools)
		await refresh.reject('Still unavailable')
		await vi.waitFor(async () => {
			await act(async () => expect(refresh.container.textContent).toContain('Still unavailable'))
		})

		// The retry that succeeds restores the page and sort the scenario asked for.
		await retryOnce(refresh, hydratedPools)
		await refresh.resolve(scenario.filter ? [] : POOLS)
		await vi.waitFor(async () => {
			await act(async () => {
				expect(refresh.state()).toEqual({
					pools: scenario.pools,
					noPools: scenario.filter,
					retry: false
				})
			})
		})
		expect(refresh.earnRequests()).toHaveLength(3)
	} finally {
		await refresh.unmount()
	}
})

/** Double-clicks Retry, which must start exactly one request and disable itself while it runs. */
async function retryOnce(refresh: Awaited<ReturnType<typeof mountRefresh>>, hydratedPools: Array<string>) {
	refresh.restart()
	const retry = refresh.findButton('Retry')!
	await act(async () => {
		retry.click()
		retry.click()
	})
	await vi.waitFor(async () => {
		await act(async () => {
			expect(retry.disabled).toBe(true)
			expect(refresh.container.textContent).toContain('Retrying…')
		})
	})
	expect(refresh.shownPools()).toEqual(hydratedPools)
}

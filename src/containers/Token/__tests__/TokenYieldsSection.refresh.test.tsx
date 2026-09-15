// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { ApyTriple, ApyWindows, EarnAttributes, EnrichedEarnRow, TokenKeys } from '~/containers/Yields/data/types'

const state = vi.hoisted(() => ({ rows: [] as Array<EnrichedEarnRow>, generation: 0, filter: false }))
vi.mock('~/containers/Yields/data/enrich.server', () => ({ getEnrichedEarn: async () => state.rows }))
vi.mock('~/containers/Yields/data/snapshot', async (original) => ({
	...(await original<typeof import('~/containers/Yields/data/snapshot')>()),
	readYieldsMeta: async () => ({
		halal: [],
		meme_pool_ids: ['meme'],
		tokens: { assets: [{ value: 'asset:doge', symbol: 'DOGE' }], families: [] }
	}),
	readYieldsDepegs: async () => [],
	readYieldsExploits: async () => []
}))
vi.mock('~/containers/Yields/data/server/raiseValuations', () => ({
	getRaiseValuationsUsd: async () => new Map(),
	getReferralUrls: async () => new Map()
}))
vi.mock('~/containers/Yields/VaultRisk/coveredPools', () => ({ getRiskCoveredPoolIds: async () => new Set() }))
vi.mock('~/utils/metadata', () => ({ default: { tokenDirectory: {} } }))
vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/token/[token]', query: state.filter ? { minTvl: '0' } : {}, push: vi.fn() })
}))
vi.mock('~/containers/Yields/useVerifiedAccess', () => ({
	// A signed-out reader: the section reads the public tier and shows no paid columns.
	useVerifiedAccess: () => ({
		authorizedFetch: vi.fn(),
		status: 'denied',
		hasAccess: false,
		isPending: false,
		isDenied: true
	})
}))
vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({
	ResponsiveFilterLayout: ({ children }: { children: (nested: boolean) => ReactNode }) => children(false)
}))
vi.mock('~/components/Filters/TVLRange', () => ({ TVLRange: () => null }))
vi.mock('~/containers/Yields/Filters/APYRange', () => ({ APYRange: () => null }))
vi.mock('~/containers/Yields/Filters/Chains', () => ({ FilterByChain: () => null }))
vi.mock('~/containers/Yields/hooks', () => ({
	useFormatYieldQueryParams: () => ({
		selectedChains: [],
		minTvl: state.filter ? 0 : null,
		maxTvl: null,
		minApy: null,
		maxApy: null
	})
}))
vi.mock('../deferred/DeferredPaginatedYieldsPoolTable', () => ({
	DeferredPaginatedYieldsPoolTable: ({
		data,
		initialPageIndex,
		sortingState,
		onSortingChange
	}: {
		data: Array<{ id: string }>
		initialPageIndex: number
		sortingState: Array<{ id: string; desc: boolean }>
		onSortingChange: (value: Array<{ id: string; desc: boolean }>) => void
	}) => (
		<div data-pools data-page={initialPageIndex} data-sort={JSON.stringify(sortingState)}>
			<span data-ids>{data.map((row) => row.id).join(',')}</span>
			<button type="button" onClick={() => onSortingChange([{ id: 'apy', desc: true }])}>
				Sort APY
			</button>
		</div>
	)
}))

import { getEarnPage } from '~/containers/Yields/data/earn.server'
import { getTokenEarnRows } from '~/containers/Yields/data/server/tokenPage'
import { buildInitialYieldsSnapshot } from '../queries'
import { TokenYieldsSection } from '../TokenYieldsSection'

const ZERO_TRIPLE: ApyTriple = { base: null, reward: null, total: null }
const ZERO_APY: ApyWindows = { current: ZERO_TRIPLE, avg_7d: ZERO_TRIPLE, avg_30d: ZERO_TRIPLE }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function makeRow(id: string, keys: Partial<TokenKeys>): EnrichedEarnRow {
	return {
		id,
		pool_key: id,
		pool_token: null,
		display: { label: id, detail: null },
		reference_asset_symbol: null,
		url: null,
		protocol: 'p',
		chain: 'Ethereum',
		underlying_tokens: [],
		reward_tokens: [],
		tvl_usd: 1000,
		apy: ZERO_APY,
		intrinsic: null,
		stability_30d: { base: null, base_reward: null, base_intrinsic: null, base_reward_intrinsic: null },
		holders: { count: null, avg_position_usd: null, top_10_share_pct: null },
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		protocolSlug: 'p',
		chainSlug: 'ethereum',
		isEvm: true,
		category: 'Dexs',
		hasAudit: false,
		potentialAirdrop: true,
		trend: null,
		tokenKeys: { id, ...keys },
		available_supply_usd: null
	}
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	state.generation++
	state.filter = false
	state.rows = [
		makeRow('direct', { reference_asset: ['asset:doge'], reference_asset_exact: ['asset:doge'], pool_token: [] }),
		makeRow('held', {
			reference_asset: ['asset:usd'],
			reference_asset_exact: ['asset:usd'],
			pool_token: ['asset:doge']
		}),
		makeRow('meme', { reference_asset: ['asset:doge'], reference_asset_exact: ['asset:doge'], pool_token: [] }),
		makeRow('multi', { reference_asset: ['asset:doge', 'asset:usd'], reference_asset_exact: [], pool_token: [] }),
		makeRow('unrelated', { reference_asset: ['asset:usd'], reference_asset_exact: ['asset:usd'], pool_token: [] })
	]
})
afterEach(() => vi.unstubAllGlobals())

const TVL_SORT = JSON.stringify([{ id: 'tvl', desc: true }])
const APY_SORT = JSON.stringify([{ id: 'apy', desc: true }])

const allIds = (rows: Array<{ id: string }>) => rows.map((row) => row.id).join(',')

/**
 * Mounts the section with one page of hydrated rows and a refresh whose response the caller settles.
 *
 * `filter` hydrates zero rows, which is the population that fetches on mount instead of on a click.
 */
async function mountRefresh({ filter }: { filter: boolean }) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	state.filter = filter
	const snapshot: YieldsSnapshot = {
		generationId: `token-refresh-${state.generation}`,
		generatedAt: 1,
		readJson: async () => {
			throw new Error('Unexpected artifact read')
		}
	}
	const ssr = await getTokenEarnRows(snapshot, 'DOGE')
	expect(ssr.rows.map((row) => row.id).sort()).toEqual(['direct', 'held', 'meme', 'multi'])
	const oldRequest = await getEarnPage(snapshot, { token: ssr.tokenKeys, pageSize: 'all' })
	expect(oldRequest.rows.map((row) => row.id)).toEqual(['direct'])
	const hydration = {
		...buildInitialYieldsSnapshot(ssr.rows, ssr.tokenKeys),
		rows: filter ? [] : ssr.rows.slice(0, 1),
		pageSize: 1
	}
	const pending = { response: Promise.withResolvers<Response>() }
	// What the endpoint actually returned for the in-flight request, so a successful refresh renders the
	// real population instead of one the test supplies and then asserts back to itself.
	const served: Array<Awaited<ReturnType<typeof getEarnPage>>> = []
	const fetch = vi.fn(async (input: string | URL | Request) => {
		const url = new URL(String(input), 'http://localhost')
		expect(url.pathname).toBe('/api/public/yields/earn')
		expect(url.searchParams.getAll('token')).toEqual(ssr.tokenKeys)
		expect(url.searchParams.get('tokenMatch')).toBe('contains')
		expect(url.searchParams.get('tokenOn')).toBe('both')
		expect(url.searchParams.get('includeMemeTokens')).toBe('true')
		served.push(
			await getEarnPage(snapshot, {
				...Object.fromEntries(url.searchParams),
				token: url.searchParams.getAll('token')
			})
		)
		return pending.response.promise
	})
	vi.stubGlobal('fetch', fetch)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	// A cached response under the previous selection rules must not replace the new population.
	client.setQueryData(['token-yields', 'token-page', ...ssr.tokenKeys], oldRequest.rows)
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	// Named before the render, so a failure here tears the tree down instead of leaving it mounted for
	// every later test in the file.
	const teardown = async () => {
		pending.response.resolve(Response.json({ rows: [] }))
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	}

	const findButton = (text: string) =>
		Array.from(container.querySelectorAll('button')).find((button) => button.textContent === text)

	try {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<TokenYieldsSection hydration={hydration} />
				</QueryClientProvider>
			)
		)
		expect(container.querySelector('[data-ids]')?.textContent).toBe(hydration.rows[0]?.id)
	} catch (error) {
		await teardown()
		throw error
	}

	return {
		ssr,
		hydration,
		container,
		fetch,
		findButton,
		/**
		 * Clicks the control that asks for another page. Zero hydrated rows fetch on mount instead, so
		 * those scenarios never call this, which is why the untouched-fetch check belongs here.
		 */
		async trigger(kind: 'next-page' | 'sort') {
			expect(fetch).not.toHaveBeenCalled()
			const control =
				kind === 'sort'
					? findButton('Sort APY')
					: container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')
			if (!control) throw new Error('Missing refresh control')
			await act(async () => control.click())
		},
		awaitFirstRequest: () => vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce()),
		/** Replaces the in-flight response, as a retry does. */
		restart() {
			pending.response = Promise.withResolvers<Response>()
		},
		resolve: (body: unknown) => act(async () => pending.response.resolve(Response.json(body))),
		/** Settles the in-flight refresh with the endpoint's own response; the timing stays controlled here. */
		resolveAsServed() {
			const page = served.at(-1)
			if (!page) throw new Error('No refresh in flight')
			return act(async () => pending.response.resolve(Response.json(page)))
		},
		reject: (message: string) => act(async () => pending.response.reject(new Error(message))),
		state: () => ({
			ids: container.querySelector('[data-ids]')?.textContent,
			page: container.querySelector('[data-page]')?.getAttribute('data-page') ?? null,
			sort: container.querySelector('[data-sort]')?.getAttribute('data-sort') ?? null,
			noPools: container.textContent?.includes('No yield pools found.') ?? false,
			retry: container.textContent?.includes('Retry') ?? false
		}),
		unmount: teardown
	}
}

test('keeps token-page selection through a full-data refresh', async () => {
	const refresh = await mountRefresh({ filter: false })
	try {
		await refresh.trigger('next-page')
		await refresh.awaitFirstRequest()
		// Rendered from the endpoint's own response, so an endpoint that stops returning the held or meme
		// pool fails here. Supplying `ssr.rows` and asserting them back would not.
		await refresh.resolveAsServed()

		await vi.waitFor(async () => {
			await act(async () => {
				expect(refresh.state()).toEqual({
					ids: allIds(refresh.ssr.rows),
					page: '1',
					sort: TVL_SORT,
					noPools: false,
					retry: false
				})
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
		await refresh.awaitFirstRequest()
		await refresh.resolve({ rows: [] })

		await vi.waitFor(async () => {
			await act(async () => {
				expect(refresh.state()).toEqual({ ids: undefined, page: null, sort: null, noPools: true, retry: false })
			})
		})
	} finally {
		await refresh.unmount()
	}
})

test.each([
	{ name: 'outage', filter: false, trigger: 'next-page', page: '1', sort: TVL_SORT },
	{ name: 'sort-outage', filter: false, trigger: 'sort', page: '0', sort: APY_SORT },
	{ name: 'no-rows-outage', filter: true, trigger: 'mount', page: null, sort: null }
] as const)('recovers the requested page after a $name and its failed retry', async (scenario) => {
	const refresh = await mountRefresh({ filter: scenario.filter })
	const hydratedIds = refresh.hydration.rows[0]?.id
	try {
		if (scenario.trigger !== 'mount') await refresh.trigger(scenario.trigger)
		await refresh.awaitFirstRequest()

		await refresh.reject('Yields unavailable')
		await vi.waitFor(async () => {
			await act(async () => expect(refresh.container.textContent).toContain('Yields unavailable'))
		})
		// The failed refresh leaves the hydrated selection on screen rather than emptying the table.
		expect(refresh.state().ids).toBe(hydratedIds)

		// A retry that fails again keeps that selection and offers Retry once more.
		await retryOnce(refresh, hydratedIds)
		await refresh.reject('Still unavailable')
		await vi.waitFor(async () => {
			await act(async () => expect(refresh.container.textContent).toContain('Still unavailable'))
		})

		// The retry that succeeds restores the page and sort the scenario asked for.
		await retryOnce(refresh, hydratedIds)
		await refresh.resolve({ rows: scenario.filter ? [] : refresh.ssr.rows })
		await vi.waitFor(async () => {
			await act(async () => {
				expect(refresh.state()).toEqual({
					ids: scenario.filter ? undefined : allIds(refresh.ssr.rows),
					page: scenario.page,
					sort: scenario.sort,
					noPools: scenario.filter,
					retry: false
				})
			})
		})

		expect(refresh.fetch).toHaveBeenCalledTimes(3)
	} finally {
		await refresh.unmount()
	}
})

/** Double-clicks Retry, which must start exactly one request and disable itself while it runs. */
async function retryOnce(refresh: Awaited<ReturnType<typeof mountRefresh>>, hydratedIds: string | undefined) {
	refresh.restart()
	const retry = refresh.findButton('Retry')
	if (!retry) throw new Error('Missing Retry action')
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
	expect(refresh.state().ids).toBe(hydratedIds)
}

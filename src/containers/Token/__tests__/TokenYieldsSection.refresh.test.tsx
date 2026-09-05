// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { ApyTriple, ApyWindows, EarnAttributes, EnrichedEarnRow, TokenKeys } from '~/containers/Yields/data/types'

const state = vi.hoisted(() => ({ rows: [] as EnrichedEarnRow[], generation: 0, filter: false }))
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
			<button onClick={() => onSortingChange([{ id: 'apy', desc: true }])}>Sort APY</button>
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
		tvl_usd: 1_000,
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
		protocolHasToken: false,
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
		makeRow('meme', { reference_asset: ['asset:doge'], reference_asset_exact: ['asset:doge'], pool_token: [] })
	]
})
afterEach(() => vi.unstubAllGlobals())

it.each(['success', 'empty', 'outage', 'sort-outage', 'no-rows-outage'] as const)(
	'keeps token-page selection through a full-data %s refresh',
	async (outcome) => {
		const isOutage = outcome.endsWith('outage')
		state.filter = outcome === 'no-rows-outage'
		const snapshot: YieldsSnapshot = {
			generationId: `token-refresh-${state.generation}`,
			generatedAt: 1,
			readJson: async () => {
				throw new Error('Unexpected artifact read')
			}
		}
		const ssr = await getTokenEarnRows(snapshot, 'DOGE')
		expect(ssr.rows.map((row) => row.id).sort()).toEqual(['direct', 'held', 'meme'])
		const oldRequest = await getEarnPage(snapshot, { token: ssr.tokenKeys, pageSize: 'all' })
		expect(oldRequest.rows.map((row) => row.id)).toEqual(['direct'])
		const hydration = {
			...buildInitialYieldsSnapshot(ssr.rows, ssr.tokenKeys),
			rows: state.filter ? [] : ssr.rows.slice(0, 1),
			pageSize: 1
		}
		let response = Promise.withResolvers<Response>()
		const fetch = vi.fn(async (input: string | URL | Request) => {
			const url = new URL(String(input), 'http://localhost')
			expect(url.pathname).toBe('/api/public/yields/earn')
			expect(url.searchParams.getAll('token')).toEqual(ssr.tokenKeys)
			expect(url.searchParams.get('tokenOn')).toBe('both')
			expect(url.searchParams.get('includeMemeTokens')).toBe('true')
			const data = await getEarnPage(snapshot, {
				...Object.fromEntries(url.searchParams),
				token: url.searchParams.getAll('token')
			})
			if (outcome === 'success') response.resolve(Response.json(data))
			return response.promise
		})
		vi.stubGlobal('fetch', fetch)
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		// A cached response under the previous selection rules must not replace the new population.
		client.setQueryData(['token-yields', 'token-page', ...ssr.tokenKeys], oldRequest.rows)
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)
		try {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<TokenYieldsSection hydration={hydration} />
					</QueryClientProvider>
				)
			)
			if (!state.filter) expect(fetch).not.toHaveBeenCalled()
			expect(container.querySelector('[data-ids]')?.textContent).toBe(hydration.rows[0]?.id)
			if (!state.filter) {
				const trigger =
					outcome === 'sort-outage'
						? Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Sort APY')
						: container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')
				if (!trigger) throw new Error('Missing refresh control')
				await act(async () => trigger.click())
			}
			await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
			await act(async () => {
				if (outcome === 'empty') response.resolve(Response.json({ rows: [] }))
				if (isOutage) response.reject(new Error('Yields unavailable'))
			})
			await vi.waitFor(async () => {
				await act(async () => {
					if (outcome === 'success')
						expect(container.querySelector('[data-ids]')?.textContent).toBe(ssr.rows.map((row) => row.id).join(','))
					if (outcome === 'empty') expect(container.querySelector('[data-pools]')).toBeNull()
					if (isOutage) expect(container.textContent).toContain('Yields unavailable')
				})
			})
			if (isOutage) {
				expect(container.querySelector('[data-ids]')?.textContent).toBe(hydration.rows[0]?.id)
				for (const recovered of [false, true]) {
					response = Promise.withResolvers<Response>()
					const retry = Array.from(container.querySelectorAll('button')).find(
						(button) => button.textContent === 'Retry'
					)
					if (!retry) throw new Error('Missing Retry action')
					await act(async () => {
						retry.click()
						retry.click()
					})
					await vi.waitFor(async () => {
						await act(async () => {
							expect(retry.disabled).toBe(true)
							expect(container.textContent).toContain('Retrying…')
						})
					})
					expect(container.querySelector('[data-ids]')?.textContent).toBe(hydration.rows[0]?.id)
					await act(async () => {
						if (recovered) response.resolve(Response.json({ rows: state.filter ? [] : ssr.rows }))
						else response.reject(new Error('Still unavailable'))
					})
					await vi.waitFor(async () => {
						await act(async () => {
							if (recovered) {
								if (state.filter) {
									expect(container.textContent).toContain('No yield pools found.')
									expect(container.textContent).not.toContain('Retry')
								} else {
									expect(container.querySelector('[data-ids]')?.textContent).toBe(
										ssr.rows.map((row) => row.id).join(',')
									)
									expect(container.querySelector('[data-page]')?.getAttribute('data-page')).toBe(
										outcome === 'sort-outage' ? '0' : '1'
									)
									if (outcome === 'sort-outage')
										expect(container.querySelector('[data-sort]')?.getAttribute('data-sort')).toBe(
											JSON.stringify([{ id: 'apy', desc: true }])
										)
								}
							} else expect(container.textContent).toContain('Still unavailable')
						})
					})
				}
				expect(fetch).toHaveBeenCalledTimes(3)
			}
		} finally {
			await act(async () => root.unmount())
			container.remove()
			client.clear()
		}
	}
)

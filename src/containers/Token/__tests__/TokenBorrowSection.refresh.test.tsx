// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { EnrichedRouteRow, RouteTableRow } from '~/containers/Yields/data/types'

const state = vi.hoisted(() => ({ rows: [] as Array<EnrichedRouteRow>, generation: 0 }))
vi.mock('~/containers/Yields/data/enrich.server', () => ({ getEnrichedRoutes: async () => state.rows }))
vi.mock('~/containers/Yields/data/snapshot', async (original) => ({
	...(await original<typeof import('~/containers/Yields/data/snapshot')>()),
	readYieldsMeta: async () => ({
		meme_pool_ids: ['meme-c', 'meme-b'],
		tokens: { assets: [{ value: 'asset:doge', symbol: 'DOGE' }], families: [] }
	}),
	readYieldsDepegs: async () => []
}))
vi.mock('~/containers/Yields/data/server/raiseValuations', () => ({
	getRaiseValuationsUsd: async () => new Map(),
	getReferralUrls: async () => new Map()
}))
vi.mock('~/containers/Yields/VaultRisk/coveredPools', () => ({ getRiskCoveredPoolIds: async () => new Set() }))
vi.mock('~/utils/metadata', () => ({ default: { tokenDirectory: {} } }))
vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({
	ResponsiveFilterLayout: ({ children }: { children: (nested: boolean) => ReactNode }) => children(false)
}))
vi.mock('~/components/Filters/FilterBetweenRange', () => ({ FilterBetweenRange: () => null }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
vi.mock('../deferred/DeferredPaginatedBorrowRoutesTable', () => ({
	DeferredPaginatedBorrowRoutesTable: ({
		data,
		initialPageIndex,
		sortingState,
		onSortingChange
	}: {
		data: Array<RouteTableRow>
		initialPageIndex: number
		sortingState: Array<{ id: string; desc: boolean }>
		onSortingChange: (value: Array<{ id: string; desc: boolean }>) => void
	}) => (
		<div data-routes data-page={initialPageIndex} data-sort={JSON.stringify(sortingState)}>
			<span data-ids>{data.map((row) => `${row.collateralId}:${row.borrowId}`).join(',')}</span>
			<button type="button" onClick={() => onSortingChange([{ id: 'available', desc: true }])}>
				Sort Available
			</button>
		</div>
	)
}))
import { getBorrowRoutesPage } from '~/containers/Yields/data/borrow.server'
import { getTokenBorrowRoutes } from '~/containers/Yields/data/server/tokenPage'
import { buildInitialBorrowRoutesSnapshot } from '../queries'
import { TokenBorrowSection } from '../TokenBorrowSection'

function route(
	collateralId: string,
	borrowId: string,
	collateralSymbol: string,
	borrowSymbol: string
): EnrichedRouteRow {
	const triple = { base: 1, reward: 0, total: 1 }
	const apy = { current: triple, avg_7d: triple, avg_30d: triple }
	const composition = { base: 0, base_reward: 0, base_intrinsic: null, base_reward_intrinsic: null }
	const token = (symbol: string) => ({ address: symbol, symbol, decimals: null })
	return {
		protocol: 'p',
		chain: 'Ethereum',
		display: { detail: null },
		protocolSlug: 'p',
		chainSlug: 'ethereum',
		isEvm: true,
		category: null,
		hasAudit: false,
		protocolHasToken: false,
		collateral: {
			id: collateralId,
			pool_key: collateralId,
			url: null,
			token: token(collateralSymbol),
			loan_to_value: 0.8,
			total_supply_usd: 1000,
			apy,
			intrinsic: null,
			reward_tokens: []
		},
		borrow: {
			id: borrowId,
			pool_key: borrowId,
			url: null,
			token: token(borrowSymbol),
			total_borrow_usd: 100,
			available_borrow_usd: 900,
			cost_apy: apy,
			intrinsic: null,
			reward_tokens: []
		},
		net_apy: { current: composition, avg_7d: composition, avg_30d: composition },
		collateralTokenKeys: [`asset:${collateralSymbol.toLowerCase()}`],
		borrowTokenKeys: [`asset:${borrowSymbol.toLowerCase()}`]
	}
}
afterEach(() => vi.unstubAllGlobals())

test.each(['use', 'borrow', 'sort', 'empty', 'no-rows'] as const)(
	'retains meme routes and recovers the requested %s page after either leg fails',
	async (scenario) => {
		const tab = scenario === 'borrow' || scenario === 'no-rows' ? 'borrow' : 'use'
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		state.rows = [
			route('plain-c', 'plain-b', 'DOGE', 'DOGE'),
			route('meme-c', 'usd-b', 'DOGE', 'USD'),
			route('usd-c', 'meme-b', 'USD', 'DOGE')
		]
		const snapshot: YieldsSnapshot = {
			generationId: `borrow-refresh-${++state.generation}`,
			generatedAt: 1,
			readJson: async () => {
				throw new Error('Unexpected read')
			}
		}
		const ssr = await getTokenBorrowRoutes(snapshot, 'DOGE')
		expect(ssr.useAsCollateral).toHaveLength(2)
		expect(ssr.borrowThis).toHaveLength(2)
		for (const leg of ['collateralToken', 'borrowToken']) {
			const old = await getBorrowRoutesPage(snapshot, { [leg]: ssr.tokenKeys, pageSize: 'all' })
			expect(old.rows).toHaveLength(1)
		}
		const unmatched = await getTokenBorrowRoutes(snapshot, 'UNKNOWN')
		expect(unmatched.useAsCollateral).toEqual([])
		expect(unmatched.borrowThis).toEqual([])
		const initial = buildInitialBorrowRoutesSnapshot(ssr, ssr.tokenKeys)
		if (!initial) throw new Error('Missing hydration')
		const hydration = {
			...initial,
			pageSize: 1,
			data: {
				useAsCollateral: scenario === 'no-rows' ? [] : ssr.useAsCollateral.slice(0, 1),
				borrowThis: ssr.borrowThis.slice(0, 1)
			}
		}
		let collateral = Promise.withResolvers<Response>()
		let borrow = Promise.withResolvers<Response>()
		const fetch = vi.fn(async (input: string | URL | Request) => {
			const url = new URL(String(input), 'http://localhost')
			expect(url.pathname).toBe('/api/public/yields/borrow-routes')
			expect(url.searchParams.get('includeMemeTokens')).toBe('true')
			const leg = url.searchParams.has('collateralToken') ? 'collateralToken' : 'borrowToken'
			expect(url.searchParams.getAll(leg)).toEqual(ssr.tokenKeys)
			const full = await getBorrowRoutesPage(snapshot, {
				...Object.fromEntries(url.searchParams),
				[leg]: url.searchParams.getAll(leg)
			})
			expect(full.rows).toEqual(leg === 'collateralToken' ? ssr.useAsCollateral : ssr.borrowThis)
			return leg === 'collateralToken' ? collateral.promise : borrow.promise
		})
		vi.stubGlobal('fetch', fetch)
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		client.setQueryData(['token-borrow-routes', 'token-page', ...ssr.tokenKeys], {
			useAsCollateral: [],
			borrowThis: []
		})
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)
		const findRadio = (label: string) => {
			const radio = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
				(input) => input.parentElement?.textContent === label
			)
			if (!radio) throw new Error(`Missing radio: ${label}`)
			return radio
		}
		const findButton = (text: string) => {
			const b = Array.from(container.querySelectorAll('button')).find((x) => x.textContent === text)
			if (!b) throw new Error(`Missing ${text}`)
			return b
		}
		try {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<TokenBorrowSection tokenSymbol="DOGE" hydration={hydration} />
					</QueryClientProvider>
				)
			)
			// The segmented control exposes the leg by its accessible label.
			if (tab === 'borrow') {
				await act(async () => findRadio('Borrow DOGE').click())
			}
			let retained = container.querySelector('[data-ids]')?.textContent
			expect(retained).toBeTruthy()
			expect(fetch).not.toHaveBeenCalled()
			const next =
				scenario === 'sort'
					? findButton('Sort Available')
					: container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')
			if (!next) throw new Error('Missing next page')
			await act(async () => next.click())
			await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
			await act(async () => {
				if (tab === 'use') {
					collateral.reject(new Error('Collateral failed'))
					borrow.resolve(Response.json({ rows: ssr.borrowThis }))
				} else {
					borrow.reject(new Error('Debt failed'))
					collateral.resolve(Response.json({ rows: ssr.useAsCollateral }))
				}
			})
			await vi.waitFor(async () => {
				await act(async () => expect(findButton('Retry').disabled).toBe(false))
			})
			expect(container.querySelector('[data-ids]')?.textContent).toBe(retained)
			if (scenario === 'no-rows') {
				await act(async () => findRadio('Use DOGE').click())
				retained = undefined
				expect(container.querySelector('[data-ids]')).toBeNull()
				expect(findButton('Retry').disabled).toBe(false)
			}
			for (const recover of [false, true]) {
				collateral = Promise.withResolvers<Response>()
				borrow = Promise.withResolvers<Response>()
				await act(async () => {
					findButton('Retry').click()
					findButton('Retry').click()
				})
				await vi.waitFor(async () => {
					await act(async () => expect(findButton('Retrying…').disabled).toBe(true))
				})
				await act(async () =>
					collateral.resolve(Response.json({ rows: scenario === 'empty' ? [] : ssr.useAsCollateral }))
				)
				expect(container.querySelector('[data-ids]')?.textContent).toBe(retained)
				expect(findButton('Retrying…').disabled).toBe(true)
				await act(async () => {
					if (recover) borrow.resolve(Response.json({ rows: scenario === 'empty' ? [] : ssr.borrowThis }))
					else borrow.reject(new Error('Still unavailable'))
				})
				await vi.waitFor(async () => {
					await act(async () => {
						if (recover) {
							if (scenario === 'empty') expect(container.textContent).toContain('No borrow routes found')
							else
								expect(container.querySelector('[data-page]')?.getAttribute('data-page')).toBe(
									scenario === 'sort' || scenario === 'no-rows' ? '0' : '1'
								)
							if (scenario === 'sort')
								expect(container.querySelector('[data-sort]')?.getAttribute('data-sort')).toBe(
									JSON.stringify([{ id: 'available', desc: true }])
								)
							expect(container.textContent).not.toContain('Retry')
						} else expect(findButton('Retry').disabled).toBe(false)
					})
				})
			}
			expect(fetch).toHaveBeenCalledTimes(6)
			const rows = tab === 'use' || scenario === 'no-rows' ? ssr.useAsCollateral : ssr.borrowThis
			expect(container.querySelector('[data-ids]')?.textContent).toBe(
				scenario === 'empty' ? undefined : rows.map((row) => `${row.collateralId}:${row.borrowId}`).join(',')
			)
		} finally {
			await act(async () => root.unmount())
			container.remove()
			client.clear()
		}
	}
)

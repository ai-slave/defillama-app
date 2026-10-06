// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TokenBorrowSection } from '../TokenBorrowSection'
import type { TokenBorrowRoutesHydration } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/token/[token]', push: vi.fn() }) }))
// Heavy filter controls the assertions never read.
vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({
	ResponsiveFilterLayout: ({ children }: { children: (nested: boolean) => ReactNode }) => children(false)
}))
vi.mock('~/components/Filters/FilterBetweenRange', () => ({ FilterBetweenRange: () => null }))
vi.mock('~/components/Select/SelectWithCombobox', () => ({ SelectWithCombobox: () => null }))
// Render the real routes table eagerly instead of through its lazy chunk.
vi.mock('../deferred/DeferredPaginatedBorrowRoutesTable', async () => ({
	DeferredPaginatedBorrowRoutesTable: (await import('~/containers/Yields/Tables/Borrow')).PaginatedBorrowRoutesTable
}))

const http = installFixtureFetch()

function route(id: string, netApy: number, availableBorrowUsd: number): RouteTableRow {
	return {
		id,
		collateralId: `${id}-collateral`,
		borrowId: `${id}-borrow`,
		configID: id,
		pool: id,
		poolMeta: null,
		url: null,
		project: 'P',
		projectslug: 'p',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		collateralSymbol: 'DOGE',
		borrowSymbol: 'USD',
		supplyApy: 1,
		supplyApyBase: 1,
		supplyApyReward: null,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 1,
		borrowApyBase: 1,
		borrowApyReward: null,
		borrowApyIntrinsic: null,
		borrowIntrinsicSourceSymbol: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		netApy,
		availableBorrowUsd,
		totalBorrowUsd: 100,
		borrowCapacityFilled: 0.1,
		ltv: 0.8
	}
}

// The table shows one route per page. By the default net-APY sort the first route leads; by available
// liquidity the second one does.
const USE_ROUTES = [route('use-1', 5, 100), route('use-2', 1, 900)]
const BORROW_ROUTES = [route('borrow-1', 5, 100), route('borrow-2', 1, 900)]

/**
 * `recovered` is the section after the failing leg finally succeeds, so a scenario whose name drifts fails
 * on a diff instead of quietly asserting nothing.
 */
const SCENARIOS = [
	{
		name: 'use',
		tab: 'use',
		trigger: 'next-page',
		hydratesCollateral: true,
		switchesLegAfterFailure: false,
		recovered: { rows: ['use-2'], noRoutes: false, retry: false },
		finalIsEmpty: false
	},
	{
		name: 'borrow',
		tab: 'borrow',
		trigger: 'next-page',
		hydratesCollateral: true,
		switchesLegAfterFailure: false,
		recovered: { rows: ['borrow-2'], noRoutes: false, retry: false },
		finalIsEmpty: false
	},
	{
		name: 'sort',
		tab: 'use',
		trigger: 'sort',
		hydratesCollateral: true,
		switchesLegAfterFailure: false,
		recovered: { rows: ['use-2'], noRoutes: false, retry: false },
		finalIsEmpty: false
	},
	{
		name: 'empty',
		tab: 'use',
		trigger: 'next-page',
		hydratesCollateral: true,
		switchesLegAfterFailure: false,
		recovered: { rows: [], noRoutes: true, retry: false },
		finalIsEmpty: true
	},
	{
		name: 'no-rows',
		tab: 'borrow',
		trigger: 'next-page',
		hydratesCollateral: false,
		switchesLegAfterFailure: true,
		recovered: { rows: ['use-1'], noRoutes: false, retry: false },
		finalIsEmpty: false
	}
] as const

test.each(SCENARIOS)(
	'keeps hydrated routes and recovers the requested $name view after a leg fails',
	async (scenario) => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		const hydration: TokenBorrowRoutesHydration = {
			tokenKeys: ['asset:doge'],
			data: {
				useAsCollateral: scenario.hydratesCollateral ? USE_ROUTES.slice(0, 1) : [],
				borrowThis: BORROW_ROUTES.slice(0, 1)
			},
			counts: { useAsCollateral: 2, borrowThis: 2 },
			chainLists: { useAsCollateral: ['Ethereum'], borrowThis: ['Ethereum'] },
			pageSize: 1
		}
		let collateral = Promise.withResolvers<Response>()
		let borrow = Promise.withResolvers<Response>()
		http.serve({
			'/api/public/yields/borrow-routes': (url: URL) =>
				url.searchParams.has('collateralToken') ? collateral.promise : borrow.promise
		})
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)
		const findRadio = (label: string) =>
			[...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
				(input) => input.parentElement?.textContent === label
			)!
		const findButton = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === text)!
		const shownIds = () =>
			[...container.querySelectorAll('tbody tr')].map((row) => row.textContent?.match(/(use|borrow)-\d/)?.[0])
		const sectionState = () => ({
			rows: shownIds(),
			noRoutes: container.textContent?.includes('No borrow routes found') ?? false,
			retry: container.textContent?.includes('Retry') ?? false
		})
		const waitForRetryEnabled = () =>
			waitForUi(async () => {
				await act(async () => expect(findButton('Retry')?.getAttribute('aria-disabled')).toBe(null))
			})
		/** Double-clicks Retry, which must start one request per leg; resolves collateral and leaves the debt leg. */
		const retry = async (retained: Array<string>) => {
			collateral = Promise.withResolvers<Response>()
			borrow = Promise.withResolvers<Response>()
			await act(async () => {
				findButton('Retry').click()
				findButton('Retry').click()
			})
			await waitForUi(async () => {
				// A retry in flight keeps its focus and ignores presses: busy and aria-disabled, never natively disabled.
				await act(async () => {
					const pending = container.querySelector<HTMLButtonElement>('button[aria-busy="true"]')!
					expect(pending.textContent).toContain('Retrying…')
					expect([pending.getAttribute('aria-disabled'), pending.disabled]).toEqual(['true', false])
				})
			})
			await act(async () => collateral.resolve(Response.json({ rows: scenario.finalIsEmpty ? [] : USE_ROUTES })))
			expect(shownIds()).toEqual(retained)
		}
		try {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<TokenBorrowSection tokenSymbol="DOGE" hydration={hydration} />
					</QueryClientProvider>
				)
			)
			if (scenario.tab === 'borrow') await act(async () => findRadio('Borrow DOGE').click())
			const hydrated = shownIds()
			expect(hydrated).toEqual([scenario.tab === 'use' ? 'use-1' : 'borrow-1'])
			expect(http.requests).toHaveLength(0)

			const next =
				scenario.trigger === 'sort'
					? [...container.querySelectorAll<HTMLButtonElement>('thead button')].find(
							(b) => b.textContent === 'Available'
						)!
					: container.querySelector<HTMLButtonElement>('[aria-label="Go to next page"]')!
			await act(async () => next.click())
			await waitForUi(() => expect(http.requests).toHaveLength(2))
			await act(async () => {
				if (scenario.tab === 'use') {
					collateral.reject(new Error('Collateral failed'))
					borrow.resolve(Response.json({ rows: BORROW_ROUTES }))
				} else {
					borrow.reject(new Error('Debt failed'))
					collateral.resolve(Response.json({ rows: USE_ROUTES }))
				}
			})
			await waitForRetryEnabled()
			expect(shownIds()).toEqual(hydrated)

			// Switching to the leg that hydrated empty must show nothing rather than the other leg's rows.
			if (scenario.switchesLegAfterFailure) await act(async () => findRadio('Use DOGE').click())
			const retained = scenario.switchesLegAfterFailure ? [] : hydrated
			expect(shownIds()).toEqual(retained)

			// A retry whose debt leg fails again keeps the rows and re-enables Retry.
			await retry(retained)
			await act(async () => borrow.reject(new Error('Still unavailable')))
			await waitForRetryEnabled()

			await retry(retained)
			await act(async () => borrow.resolve(Response.json({ rows: scenario.finalIsEmpty ? [] : BORROW_ROUTES })))
			await waitForUi(async () => {
				await act(async () => expect(sectionState()).toEqual(scenario.recovered))
			})
			expect(http.requests).toHaveLength(6)
		} finally {
			await act(async () => root.unmount())
			container.remove()
			client.clear()
		}
	}
)

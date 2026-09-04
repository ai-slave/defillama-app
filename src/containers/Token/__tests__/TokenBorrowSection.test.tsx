// @vitest-environment happy-dom

import type { SortingState } from '@tanstack/react-table'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import type { TokenBorrowRoutesData } from '../types'

const strategiesState: {
	data: TokenBorrowRoutesData | undefined
	error: Error | null
	isLoading: boolean
} = {
	data: {
		useAsCollateral: [],
		borrowThis: []
	},
	error: null,
	isLoading: false
}

const { routesTableCalls } = vi.hoisted(() => ({
	routesTableCalls: [] as Array<{
		appearance?: string
		dataLength: number
		initialPageIndex?: number
		initialPageSize?: number
	}>
}))

vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({
	ResponsiveFilterLayout: ({ children }: { children: (nestedMenu: boolean) => React.ReactNode }) => (
		<div>{children(false)}</div>
	)
}))

vi.mock('~/components/Filters/FilterBetweenRange', () => ({
	FilterBetweenRange: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>
}))

vi.mock('~/ui/Icon', () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>
}))

vi.mock('~/ui/Loaders', () => ({
	LocalLoader: () => <div>loader</div>,
	LoadingSpinner: () => <div>spinner</div>,
	LoadingDots: () => <span>...</span>
}))

vi.mock('~/components/Select/SelectWithCombobox', () => ({
	SelectWithCombobox: ({ label }: { label: string }) => <div>{label}</div>
}))

vi.mock('../deferred/DeferredPaginatedBorrowRoutesTable', () => ({
	DeferredPaginatedBorrowRoutesTable: ({
		data,
		appearance,
		initialPageSize,
		initialPageIndex,
		onSortingChange
	}: {
		data: RouteTableRow[]
		appearance?: string
		initialPageSize?: number
		initialPageIndex?: number
		onSortingChange?: (sorting: SortingState) => void
	}) => {
		routesTableCalls.push({
			dataLength: data.length,
			...(appearance !== undefined ? { appearance } : {}),
			...(initialPageIndex !== undefined ? { initialPageIndex } : {}),
			...(initialPageSize !== undefined ? { initialPageSize } : {})
		})
		return (
			<button
				type="button"
				data-routes-table
				onClick={() => onSortingChange?.([{ id: 'available_borrow', desc: true }])}
			>
				Routes table
			</button>
		)
	}
}))

vi.mock('../useTokenBorrowRoutes', () => ({
	useTokenBorrowRoutes: (_tokenKeys: string[], options?: { enabled?: boolean }) =>
		options?.enabled === false ? { data: undefined, error: null, isLoading: false } : strategiesState
}))

afterEach(() => {
	strategiesState.data = {
		useAsCollateral: [],
		borrowThis: []
	}
	strategiesState.error = null
	strategiesState.isLoading = false
	routesTableCalls.length = 0
	vi.clearAllMocks()
	vi.restoreAllMocks()
})

import { TokenBorrowSection } from '../TokenBorrowSection'
import { filterBorrowRoutes } from '../TokenBorrowSection.utils'

function makeRouteRow(overrides: Partial<RouteTableRow> = {}): RouteTableRow {
	return {
		id: 'coll:borrow',
		collateralId: 'coll',
		borrowId: 'borrow',
		configID: 'borrow',
		pool: 'ETH / USDC',
		poolMeta: null,
		url: 'https://example.com/pool',
		project: 'Aave',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		collateralSymbol: 'ETH',
		borrowSymbol: 'USDC',
		supplyApy: 3,
		supplyApyBase: 3,
		supplyApyReward: null,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 2,
		borrowApyBase: 2,
		borrowApyReward: null,
		borrowApyIntrinsic: null,
		borrowIntrinsicSourceSymbol: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		netApy: 5,
		availableBorrowUsd: 500_000,
		totalBorrowUsd: 1_000_000,
		borrowCapacityFilled: 0.5,
		ltv: 0.8,
		...overrides
	}
}

const hydrationBase = { tokenKeys: ['family:eth'] }

describe('TokenBorrowSection', () => {
	it('preserves the controlled table instance when sorting changes', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		strategiesState.data = { useAsCollateral: [makeRouteRow()], borrowThis: [] }
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)

		try {
			await act(async () => root.render(<TokenBorrowSection tokenSymbol="ETH" />))
			const table = container.querySelector<HTMLButtonElement>('[data-routes-table]')
			expect(table).not.toBeNull()

			await act(async () => table!.click())

			expect(container.querySelector('[data-routes-table]')).toBe(table)
		} finally {
			await act(async () => root.unmount())
			container.remove()
		}
	})

	it('shows a loader while shared token routes are loading', () => {
		strategiesState.data = undefined
		strategiesState.error = null
		strategiesState.isLoading = true

		const html = renderToStaticMarkup(<TokenBorrowSection tokenSymbol="ETH" />)

		expect(html).toContain('Loading')
		expect(html).toContain('Use ETH')
		expect(html).toContain('Borrow ETH')
	})

	it('shows the default use-token table with pagination', () => {
		strategiesState.data = {
			useAsCollateral: [makeRouteRow()],
			borrowThis: [makeRouteRow({ collateralSymbol: 'WBTC', borrowSymbol: 'ETH', availableBorrowUsd: 250_000 })]
		}
		strategiesState.error = null
		strategiesState.isLoading = false

		const html = renderToStaticMarkup(<TokenBorrowSection tokenSymbol="ETH" />)

		expect(html).toContain('Tracking 1 route')
		expect(html).toContain('Available')
		expect(routesTableCalls[0]).toMatchObject({
			appearance: 'embedded',
			dataLength: 1,
			initialPageIndex: 0,
			initialPageSize: 10
		})
	})

	it('renders prefetched routes without waiting for a client fetch', () => {
		strategiesState.data = undefined
		strategiesState.error = null
		strategiesState.isLoading = true

		const html = renderToStaticMarkup(
			<TokenBorrowSection
				tokenSymbol="ETH"
				hydration={{
					...hydrationBase,
					data: {
						useAsCollateral: [makeRouteRow()],
						borrowThis: []
					},
					counts: {
						useAsCollateral: 1,
						borrowThis: 0
					},
					chainLists: {
						useAsCollateral: ['Ethereum'],
						borrowThis: []
					},
					pageSize: 10
				}}
			/>
		)

		expect(html).toContain('Tracking 1 route')
		expect(routesTableCalls[0]).toMatchObject({ dataLength: 1, initialPageIndex: 0, initialPageSize: 10 })
	})

	it('shows deferred pagination controls when only the first page is prefetched', () => {
		strategiesState.data = undefined
		strategiesState.error = null
		strategiesState.isLoading = false

		const html = renderToStaticMarkup(
			<TokenBorrowSection
				tokenSymbol="ETH"
				hydration={{
					...hydrationBase,
					data: {
						useAsCollateral: [makeRouteRow()],
						borrowThis: []
					},
					counts: {
						useAsCollateral: 25,
						borrowThis: 0
					},
					chainLists: {
						useAsCollateral: ['Ethereum'],
						borrowThis: []
					},
					pageSize: 10
				}}
			/>
		)

		expect(html).toContain('Showing 1 of 25 routes')
		expect(html).toContain('Page 1 of 3')
	})

	it('shows an empty state when no routes exist for the selected tab', () => {
		const html = renderToStaticMarkup(<TokenBorrowSection tokenSymbol="ETH" />)

		expect(html).toContain('No borrow routes found using ETH as collateral.')
	})

	it('filters routes by exact chain and available liquidity bounds', () => {
		const filtered = filterBorrowRoutes({
			rows: [
				makeRouteRow({ borrowSymbol: 'USDC', availableBorrowUsd: 500_000, chains: ['Ethereum'] }),
				makeRouteRow({ borrowSymbol: 'DAI', availableBorrowUsd: 5_000, chains: ['Arbitrum'] })
			],
			selectedChains: ['Ethereum'],
			minAvailable: '10000',
			maxAvailable: ''
		})

		expect(filtered).toHaveLength(1)
		expect(filtered.map((row) => row.borrowSymbol)).toEqual(['USDC'])
	})

	it('ignores non-numeric available liquidity bounds', () => {
		const filtered = filterBorrowRoutes({
			rows: [
				makeRouteRow({ borrowSymbol: 'USDC', availableBorrowUsd: null, chains: ['Ethereum'] }),
				makeRouteRow({ borrowSymbol: 'DAI', availableBorrowUsd: 5_000, chains: ['Ethereum'] })
			],
			selectedChains: ['Ethereum'],
			minAvailable: 'not-a-number',
			maxAvailable: 'also-not-a-number'
		})

		expect(filtered).toHaveLength(2)
	})

	it('returns no rows when no chains are selected explicitly', () => {
		const filtered = filterBorrowRoutes({
			rows: [makeRouteRow({ borrowSymbol: 'USDC', availableBorrowUsd: 500_000, chains: ['Ethereum'] })],
			selectedChains: [],
			minAvailable: '',
			maxAvailable: ''
		})

		expect(filtered).toHaveLength(0)
	})
})

import { describe, expect, test } from 'vitest'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { filterBorrowRoutes, formatBorrowRoutesSummary } from '../TokenBorrowSection.utils'

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

describe('token borrow routes', () => {
	test('counts only loaded routes until the full dataset arrives', () => {
		expect(formatBorrowRoutesSummary({ shownCount: 1, totalCount: 25, isPartial: true })).toBe('Showing 1 of 25 routes')
		expect(formatBorrowRoutesSummary({ shownCount: 1, totalCount: 1, isPartial: false })).toBe('Tracking 1 route')
		expect(formatBorrowRoutesSummary({ shownCount: 3, totalCount: 25, isPartial: false })).toBe('Tracking 3 routes')
		expect(formatBorrowRoutesSummary({ shownCount: 0, totalCount: 25, isPartial: true })).toBeNull()
	})

	test('filters routes by exact chain and available liquidity bounds', () => {
		const filtered = filterBorrowRoutes({
			rows: [
				makeRouteRow({ borrowSymbol: 'USDC', availableBorrowUsd: 500_000, chains: ['Ethereum'] }),
				makeRouteRow({ borrowSymbol: 'DAI', availableBorrowUsd: 5000, chains: ['Arbitrum'] })
			],
			selectedChains: ['Ethereum'],
			minAvailable: '10000',
			maxAvailable: ''
		}).rows

		expect(filtered).toHaveLength(1)
		expect(filtered.map((row) => row.borrowSymbol)).toEqual(['USDC'])
	})

	test('ignores non-numeric available liquidity bounds', () => {
		const filtered = filterBorrowRoutes({
			rows: [
				makeRouteRow({ borrowSymbol: 'USDC', availableBorrowUsd: null, chains: ['Ethereum'] }),
				makeRouteRow({ borrowSymbol: 'DAI', availableBorrowUsd: 5000, chains: ['Ethereum'] })
			],
			selectedChains: ['Ethereum'],
			minAvailable: 'not-a-number',
			maxAvailable: 'also-not-a-number'
		}).rows

		expect(filtered).toHaveLength(2)
	})

	test('returns no rows when no chains are selected explicitly', () => {
		const filtered = filterBorrowRoutes({
			rows: [makeRouteRow({ borrowSymbol: 'USDC', availableBorrowUsd: 500_000, chains: ['Ethereum'] })],
			selectedChains: [],
			minAvailable: '',
			maxAvailable: ''
		}).rows

		expect(filtered).toHaveLength(0)
	})
})

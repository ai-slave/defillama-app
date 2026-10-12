import { describe, expect, test } from 'vitest'
import type { LoopTableRow, MarketTableRow, RouteTableRow } from '../data/types'
import { prepareBorrowMarketsCsv, prepareBorrowRoutesCsv } from '../domain/borrowCsv'
import { prepareLoopsCsv } from '../domain/loopCsv'

const MARKET_HEADERS = [
	'Market',
	'Protocol',
	'Chain',
	'Supply APY Base',
	'Supply APY Reward',
	'Supply APY',
	'Borrow APY Base',
	'Borrow APY Reward',
	'Borrow APY',
	'Available',
	'Borrowed',
	'LTV'
]
const ROUTE_HEADERS = [
	'Collateral / Borrow',
	'Protocol',
	'Chain',
	'Net APY',
	'Supply APY Base',
	'Supply APY Reward',
	'Supply APY',
	'Borrow APY Base',
	'Borrow APY Reward',
	'Borrow APY',
	'Available',
	'LTV'
]
const LOOP_HEADERS = [
	'Token',
	'Protocol',
	'Chain',
	'Looped APY',
	'Leverage',
	'Supply APY Base',
	'Supply APY Reward',
	'Supply APY',
	'Borrow APY Base',
	'Borrow APY Reward',
	'Borrow APY',
	'Available',
	'LTV'
]

function marketRow(overrides: Partial<MarketTableRow> = {}): MarketTableRow {
	return {
		id: 'market-0',
		configID: 'market-0',
		pool: 'ETH',
		poolMeta: null,
		url: null,
		project: 'Aave V3',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		supplyApy: 3,
		supplyApyBase: null,
		supplyApyReward: null,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 5,
		borrowApyBase: null,
		borrowApyReward: null,
		borrowApyIntrinsic: null,
		borrowIntrinsicSourceSymbol: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		collateralSymbol: 'ETH',
		borrowSymbol: 'USDC',
		totalSupplyUsd: 10_000,
		availableBorrowUsd: 6000,
		totalBorrowUsd: 4000,
		borrowCapacityFilled: 0.4,
		ltv: 0.8,
		...overrides
	}
}

function routeRow(overrides: Partial<RouteTableRow> = {}): RouteTableRow {
	return {
		id: 'route-0',
		collateralId: 'c-0',
		borrowId: 'b-0',
		configID: 'route-0',
		pool: 'ETH / USDC',
		poolMeta: null,
		url: null,
		project: 'Aave V3',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		collateralSymbol: 'ETH',
		borrowSymbol: 'USDC',
		supplyApy: 3,
		supplyApyBase: null,
		supplyApyReward: null,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 5,
		borrowApyBase: null,
		borrowApyReward: null,
		borrowApyIntrinsic: null,
		borrowIntrinsicSourceSymbol: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		netApy: -2,
		availableBorrowUsd: 6000,
		totalBorrowUsd: 4000,
		borrowCapacityFilled: 0.4,
		ltv: 0.8,
		...overrides
	}
}

function loopRow(overrides: Partial<LoopTableRow> = {}): LoopTableRow {
	return {
		id: 'loop-0',
		configID: 'loop-0',
		pool: 'wstETH',
		poolMeta: null,
		url: null,
		project: 'Aave V3',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		leverage: 4.5,
		supplyApy: 3,
		supplyApyBase: null,
		supplyApyReward: null,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 2,
		borrowApyBase: null,
		borrowApyReward: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		loopApy: 7,
		availableBorrowUsd: 6000,
		totalBorrowUsd: 4000,
		borrowCapacityFilled: 0.4,
		ltv: 0.9,
		loopCount: 5,
		...overrides
	}
}

describe('prepareBorrowMarketsCsv', () => {
	test('maps a market row into the header column order', () => {
		const csv = prepareBorrowMarketsCsv([
			marketRow({
				pool: 'WBTC',
				project: 'Morpho',
				chain: 'Base',
				supplyApy: 1.5,
				borrowApy: 6.25,
				availableBorrowUsd: 9000,
				totalBorrowUsd: 1000,
				ltv: 0.75
			})
		])
		expect(csv.rows).toEqual([
			MARKET_HEADERS,
			['WBTC', 'Morpho', 'Base', null, null, 1.5, null, null, 6.25, 9000, 1000, 0.75]
		])
	})
})

describe('prepareBorrowRoutesCsv', () => {
	test('maps a route row into the header column order', () => {
		const csv = prepareBorrowRoutesCsv([
			routeRow({
				pool: 'ETH / DAI',
				project: 'Spark',
				chain: 'Ethereum',
				supplyApy: 2,
				borrowApy: 4,
				netApy: -1.5,
				availableBorrowUsd: 12_000,
				ltv: 0.82
			})
		])
		expect(csv.rows).toEqual([
			ROUTE_HEADERS,
			['ETH / DAI', 'Spark', 'Ethereum', -1.5, null, null, 2, null, null, 4, 12_000, 0.82]
		])
	})
})

describe('prepareLoopsCsv', () => {
	test('maps a loop row into the header column order', () => {
		const csv = prepareLoopsCsv([
			loopRow({
				pool: 'weETH',
				project: 'Fluid',
				chain: 'Arbitrum',
				leverage: 6,
				supplyApy: 4,
				borrowApy: 3,
				loopApy: 9,
				availableBorrowUsd: 15_000,
				ltv: 0.93
			})
		])
		expect(csv.rows).toEqual([
			LOOP_HEADERS,
			['weETH', 'Fluid', 'Arbitrum', 9, 6, null, null, 4, null, null, 3, 15_000, 0.93]
		])
	})
})

describe('dynamic csv shape', () => {
	test('base-only view keeps single total columns', () => {
		const csv = prepareBorrowMarketsCsv([], { apyComponents: 'base' })
		expect(csv.rows[0]).toEqual([
			'Market',
			'Protocol',
			'Chain',
			'Supply APY',
			'Borrow APY',
			'Available',
			'Borrowed',
			'LTV'
		])
	})

	test('non-Latest windows suffix every APY header', () => {
		const csv = prepareBorrowMarketsCsv([], { apyWindow: 'avg_7d', apyComponents: 'base' })
		expect(csv.rows[0]).toContain('Supply APY (7d)')
		expect(csv.rows[0]).toContain('Borrow APY (7d)')
	})
})

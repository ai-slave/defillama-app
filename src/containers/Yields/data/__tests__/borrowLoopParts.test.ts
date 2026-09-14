import { beforeEach, describe, expect, test, vi } from 'vitest'
import type {
	ApyTriple,
	ApyWindows,
	EnrichedLoopRow,
	EnrichedMarketRow,
	EnrichedRouteRow,
	IntrinsicApy,
	Token
} from '../types'

// The page mappers pull rows from the enrich layer; mock it so each test controls the dataset and
// exercises only toLoopTableRow / toMarketTableRow / toRouteTableRow (the per-leg component emit).
const getEnrichedLoops = vi.fn<() => Promise<Array<EnrichedLoopRow>>>()
const getEnrichedMarkets = vi.fn<() => Promise<Array<EnrichedMarketRow>>>()
const getEnrichedRoutes = vi.fn<() => Promise<Array<EnrichedRouteRow>>>()
vi.mock('../enrich.server', () => ({
	getEnrichedLoops: () => getEnrichedLoops(),
	getEnrichedMarkets: () => getEnrichedMarkets(),
	getEnrichedRoutes: () => getEnrichedRoutes()
}))
vi.mock('../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../snapshot')>()),
	readYieldsMeta: () => Promise.resolve({ halal: [], meme_pool_ids: [] }),
	readYieldsDepegs: () => Promise.resolve([]),
	readYieldsExploits: () => Promise.resolve([])
}))
// Mutable so a test can populate slug → valuation and assert the airdrop-hint stamping.
const { raiseValuationsUsdMap } = vi.hoisted(() => ({ raiseValuationsUsdMap: new Map<string, number>() }))
vi.mock('../server/raiseValuations', () => ({
	getRaiseValuationsUsd: () => Promise.resolve(raiseValuationsUsdMap),
	getReferralUrls: () => Promise.resolve(new Map<string, string>())
}))
vi.mock('~/containers/Yields/VaultRisk/coveredPools', () => ({
	getRiskCoveredPoolIds: () => Promise.resolve(new Set<string>())
}))

import {
	getBorrowMarketsPage as getBorrowMarketsPageFromSnapshot,
	getBorrowRoutesForTokenKeys as getBorrowRoutesForTokenKeysFromSnapshot,
	getBorrowRoutesPage as getBorrowRoutesPageFromSnapshot
} from '../borrow.server'
import { getLoopsPage as getLoopsPageFromSnapshot } from '../loops.server'

// Unique generation per call: the prepared-rows cache keys on generationId,
// and each test case mocks different upstream data under the same filters.
let generationCounter = 0
const nextSnapshot = () => ({ generationId: `test-${++generationCounter}` }) as never
const getBorrowMarketsPage = (query: Parameters<typeof getBorrowMarketsPageFromSnapshot>[1]) =>
	getBorrowMarketsPageFromSnapshot(nextSnapshot(), query)
const getBorrowRoutesPage = (query: Parameters<typeof getBorrowRoutesPageFromSnapshot>[1]) =>
	getBorrowRoutesPageFromSnapshot(nextSnapshot(), query)
const getBorrowRoutesForTokenKeys = (keys: Array<string>) =>
	getBorrowRoutesForTokenKeysFromSnapshot(nextSnapshot(), keys)
const getLoopsPage = (query: Parameters<typeof getLoopsPageFromSnapshot>[1]) =>
	getLoopsPageFromSnapshot(nextSnapshot(), query)

function windows(base: number | null, reward: number | null, total: number | null): ApyWindows {
	const triple: ApyTriple = { base, reward, total }
	return { current: triple, avg_7d: triple, avg_30d: triple }
}

function intrinsicApy(base: number, symbol = 'stETH'): IntrinsicApy {
	return {
		apy: { current: { base }, avg_7d: { base }, avg_30d: { base } },
		source_pool: { id: 'sp', pool_token: null, symbol }
	}
}

const token = (symbol: string): Token => ({ address: `0x${symbol}`, symbol, decimals: null })

const composition = (baseReward: number) => ({
	base: null,
	base_reward: baseReward,
	base_intrinsic: null,
	base_reward_intrinsic: baseReward
})

const ENTITY = {
	protocolSlug: 'aave-v3',
	chainSlug: 'ethereum',
	isEvm: true,
	category: null,
	hasAudit: false,
	potentialAirdrop: true
} as const

function loopRow(overrides: Partial<EnrichedLoopRow> = {}): EnrichedLoopRow {
	return {
		id: 'loop-1',
		protocol: 'Aave V3',
		chain: 'Ethereum',
		display: { detail: 'wstETH loop' },
		token: token('wstETH'),
		url: 'https://example.com',
		loan_to_value: 0.9,
		total_supply_usd: 1000,
		total_borrow_usd: 500,
		available_borrow_usd: 6000,
		supply_apy: windows(3, 1, 4),
		borrow_cost_apy: windows(2, 0.5, 1.5),
		loop_apy: { loop_count: 5, total: 20 },
		leverage: { supply_multiplier: 4.5, borrow_multiplier: 3.5 },
		intrinsic: null,
		reward_tokens: { supply: [token('BLND')], borrow: [token('BLND')] },
		...ENTITY,
		tokenKeys: null,
		...overrides
	}
}

function marketRow(overrides: Partial<EnrichedMarketRow> = {}): EnrichedMarketRow {
	return {
		id: 'market-1',
		pool_key: 'market-1',
		pool_token: null,
		protocol: 'Aave V3',
		chain: 'Ethereum',
		display: { label: 'ETH', detail: null },
		url: null,
		collateral_token: token('ETH'),
		borrow_token: token('USDC'),
		reward_tokens: [token('OP')],
		loan_to_value: 0.8,
		total_supply_usd: 1000,
		total_borrow_usd: 500,
		available_borrow_usd: 6000,
		supply_apy: windows(3, 1, 4),
		borrow_cost_apy: windows(2, 0.5, 1.5),
		intrinsic: { supply: null, borrow: null },
		...ENTITY,
		tokenKeys: null,
		...overrides
	}
}

function routeRow(overrides: Partial<EnrichedRouteRow> = {}): EnrichedRouteRow {
	return {
		protocol: 'Aave V3',
		chain: 'Ethereum',
		display: { detail: null },
		collateral: {
			id: 'c-1',
			pool_key: 'c-1',
			url: null,
			token: token('ETH'),
			loan_to_value: 0.8,
			total_supply_usd: 1000,
			apy: windows(3, 1, 4),
			intrinsic: null,
			reward_tokens: [token('ARB')]
		},
		borrow: {
			id: 'b-1',
			pool_key: 'b-1',
			url: null,
			token: token('USDC'),
			total_borrow_usd: 500,
			available_borrow_usd: 6000,
			cost_apy: windows(2, 0.5, 1.5),
			intrinsic: null,
			reward_tokens: []
		},
		net_apy: { current: composition(2.5), avg_7d: composition(2.5), avg_30d: composition(2.5) },
		...ENTITY,
		collateralTokenKeys: null,
		borrowTokenKeys: null,
		...overrides
	}
}

beforeEach(() => {
	getEnrichedLoops.mockReset()
	getEnrichedMarkets.mockReset()
	getEnrichedRoutes.mockReset()
	raiseValuationsUsdMap.clear()
})

describe('getLoopsPage per-leg components', () => {
	test('emits resolved supply/borrow base + reward (borrow leg has no intrinsic)', async () => {
		getEnrichedLoops.mockResolvedValue([loopRow()])
		const { rows } = await getLoopsPage({ pageSize: 'all' })
		expect(rows).toHaveLength(1)
		const row = rows[0]!
		expect(row.supplyApy).toBe(4)
		expect(row.supplyApyBase).toBe(3)
		expect(row.supplyApyReward).toBe(1)
		expect(row.supplyApyIntrinsic).toBeNull()
		expect(row.borrowApy).toBe(1.5)
		expect(row.borrowApyBase).toBe(2)
		expect(row.borrowApyReward).toBe(0.5)
		expect(row.supplyRewardTokensSymbols).toEqual(['BLND'])
		expect(row.borrowRewardTokensSymbols).toEqual(['BLND'])
	})

	test('drops the reward component from the view when reward is toggled off', async () => {
		getEnrichedLoops.mockResolvedValue([loopRow()])
		const { rows } = await getLoopsPage({ pageSize: 'all', apyComponents: 'base' })
		expect(rows[0]!.supplyApyReward).toBeNull()
		expect(rows[0]!.supplyApy).toBe(3)
	})

	test('surfaces the supply intrinsic component when intrinsic is toggled on', async () => {
		getEnrichedLoops.mockResolvedValue([loopRow({ intrinsic: intrinsicApy(0.7) })])
		const { rows } = await getLoopsPage({ pageSize: 'all', apyComponents: 'base,reward,intrinsic' })
		expect(rows[0]!.supplyApyIntrinsic).toBe(0.7)
		expect(rows[0]!.supplyApy).toBeCloseTo(4.7)
	})
})

describe('getBorrowMarketsPage per-leg components', () => {
	test('emits supply/borrow components + reward-token symbols', async () => {
		getEnrichedMarkets.mockResolvedValue([marketRow()])
		const { rows } = await getBorrowMarketsPage({ pageSize: 'all' })
		const row = rows[0]!
		expect(row.supplyApyBase).toBe(3)
		expect(row.supplyApyReward).toBe(1)
		expect(row.borrowApyBase).toBe(2)
		expect(row.borrowApyReward).toBe(0.5)
		expect(row.borrowApyIntrinsic).toBeNull()
		expect(row.supplyRewardTokensSymbols).toEqual(['OP'])
		expect(row.borrowRewardTokensSymbols).toEqual(['OP'])
		expect(row.collateralSymbol).toBe('ETH')
		expect(row.borrowSymbol).toBe('USDC')
		expect(row.totalSupplyUsd).toBe(1000)
	})

	test('resolves the borrow-leg intrinsic when present and toggled on', async () => {
		getEnrichedMarkets.mockResolvedValue([
			marketRow({ intrinsic: { supply: null, borrow: intrinsicApy(0.3, 'weETH') } })
		])
		const { rows } = await getBorrowMarketsPage({ pageSize: 'all', apyComponents: 'base,reward,intrinsic' })
		expect(rows[0]!.borrowApyIntrinsic).toBe(0.3)
	})
})

describe('getBorrowRoutesPage per-leg components', () => {
	test('emits supply/borrow base + reward for both legs', async () => {
		getEnrichedRoutes.mockResolvedValue([routeRow()])
		const { rows } = await getBorrowRoutesPage({ pageSize: 'all' })
		const row = rows[0]!
		expect(row.supplyApyBase).toBe(3)
		expect(row.supplyApyReward).toBe(1)
		expect(row.borrowApyBase).toBe(2)
		expect(row.borrowApyReward).toBe(0.5)
		expect(row.supplyRewardTokensSymbols).toEqual(['ARB'])
		expect(row.borrowRewardTokensSymbols).toEqual([])
	})

	test('builds collateral and borrow token tabs in one pass with the same net APY ordering', async () => {
		const keyedRoute = (
			collateralId: string,
			borrowId: string,
			netApy: number,
			collateralTokenKeys: Array<string> | null,
			borrowTokenKeys: Array<string> | null
		) => {
			const row = routeRow({
				collateralTokenKeys,
				borrowTokenKeys,
				net_apy: {
					current: composition(netApy),
					avg_7d: composition(netApy),
					avg_30d: composition(netApy)
				}
			})
			row.collateral.id = collateralId
			row.borrow.id = borrowId
			return row
		}
		getEnrichedRoutes.mockResolvedValue([
			keyedRoute('collateral-only', 'borrow-a', 1, ['asset:eth'], null),
			keyedRoute('collateral-b', 'borrow-only', 3, null, ['asset:eth']),
			keyedRoute('both-collateral', 'both-borrow', 2, ['asset:eth'], ['asset:eth'])
		])

		const result = await getBorrowRoutesForTokenKeys(['asset:eth'])
		expect(result.useAsCollateral.map((row) => row.id)).toEqual([
			'both-collateral:both-borrow',
			'collateral-only:borrow-a'
		])
		expect(result.borrowThis.map((row) => row.id)).toEqual(['collateral-b:borrow-only', 'both-collateral:both-borrow'])
	})
})

describe('airdrop raise-valuation stamping', () => {
	// ENTITY has potentialAirdrop:true + protocolSlug:'aave-v3'.
	test('stamps the valuation on an airdrop market/route/loop row', async () => {
		raiseValuationsUsdMap.set('aave-v3', 25_000_000)
		getEnrichedMarkets.mockResolvedValue([marketRow()])
		getEnrichedRoutes.mockResolvedValue([routeRow()])
		getEnrichedLoops.mockResolvedValue([loopRow()])
		expect((await getBorrowMarketsPage({ pageSize: 'all' })).rows[0]!.raiseValuationUsd).toBe(25_000_000)
		expect((await getBorrowRoutesPage({ pageSize: 'all' })).rows[0]!.raiseValuationUsd).toBe(25_000_000)
		expect((await getLoopsPage({ pageSize: 'all' })).rows[0]!.raiseValuationUsd).toBe(25_000_000)
	})

	test('leaves raiseValuationUsd null on an airdrop row with no known raise', async () => {
		getEnrichedMarkets.mockResolvedValue([marketRow()])
		const { rows } = await getBorrowMarketsPage({ pageSize: 'all' })
		expect(rows[0]!.airdrop).toBe(true)
		expect(rows[0]!.raiseValuationUsd ?? null).toBeNull()
	})

	test('never stamps a valuation on a non-airdrop row (protocol has a token)', async () => {
		raiseValuationsUsdMap.set('aave-v3', 25_000_000)
		getEnrichedMarkets.mockResolvedValue([marketRow({ potentialAirdrop: false })])
		const { rows } = await getBorrowMarketsPage({ pageSize: 'all' })
		expect(rows[0]!.airdrop).toBe(false)
		expect(rows[0]!.raiseValuationUsd ?? null).toBeNull()
	})
})

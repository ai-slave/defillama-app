import { describe, expect, test } from 'vitest'
import { SERVER_URL } from '~/constants'
import { installYieldsFixtures, yieldsMeta, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { getBorrowMarketsPage, getBorrowRoutesForTokenKeys, getBorrowRoutesPage } from '../borrow.server'
import { getLoopsPage } from '../loops.server'
import type {
	ApyTriple,
	ApyWindows,
	BorrowMarketRow,
	IntrinsicApy,
	LoopRow,
	RouteRow,
	TokenKeys,
	Token,
	YieldsMeta
} from '../types'

const http = installYieldsFixtures()

// A token-less protocol: rows under it carry the Potential Airdrop hint.
const airdropMeta = (potentialAirdrop: boolean): YieldsMeta => ({
	...yieldsMeta,
	protocols: [
		{ name: 'Aave V3', slug: 'aave-v3', category: null, has_audit: false, potential_airdrop: potentialAirdrop }
	]
})

type Artifacts = {
	loops?: Array<LoopRow>
	borrowMarkets?: Array<BorrowMarketRow>
	borrowRoutes?: Array<RouteRow>
	tokenKeys?: Array<TokenKeys>
	meta?: YieldsMeta
}
// A fresh generation (and meta, which keys the protocol-join cache) per read.
const snapshot = (data: Artifacts) => yieldsSnapshot({ meta: airdropMeta(true), ...data })

function serveRaise(name: string, valuationMillions: string) {
	http.serve({
		[`${SERVER_URL}/raises`]: {
			raises: [
				{
					date: 1,
					name,
					round: null,
					amount: null,
					chains: [],
					sector: null,
					category: null,
					categoryGroup: null,
					leadInvestors: [],
					otherInvestors: [],
					valuation: valuationMillions,
					source: ''
				}
			]
		}
	})
}

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

function loopRow(overrides: Partial<LoopRow> = {}): LoopRow {
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
		...overrides
	}
}

function marketRow(overrides: Partial<BorrowMarketRow> = {}): BorrowMarketRow {
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
		...overrides
	}
}

function routeRow(overrides: Partial<RouteRow> = {}): RouteRow {
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
		...overrides
	}
}

describe('getLoopsPage per-leg components', () => {
	test('emits resolved supply/borrow base + reward (borrow leg has no intrinsic)', async () => {
		const { rows } = await getLoopsPage(snapshot({ loops: [loopRow()] }), { pageSize: 'all' })
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
		const { rows } = await getLoopsPage(snapshot({ loops: [loopRow()] }), { pageSize: 'all', apyComponents: 'base' })
		expect(rows[0]!.supplyApyReward).toBeNull()
		expect(rows[0]!.supplyApy).toBe(3)
	})

	test('surfaces the supply intrinsic component when intrinsic is toggled on', async () => {
		const { rows } = await getLoopsPage(snapshot({ loops: [loopRow({ intrinsic: intrinsicApy(0.7) })] }), {
			pageSize: 'all',
			apyComponents: 'base,reward,intrinsic'
		})
		expect(rows[0]!.supplyApyIntrinsic).toBe(0.7)
		expect(rows[0]!.supplyApy).toBeCloseTo(4.7)
	})
})

describe('getBorrowMarketsPage per-leg components', () => {
	test('emits supply/borrow components + reward-token symbols', async () => {
		const { rows } = await getBorrowMarketsPage(snapshot({ borrowMarkets: [marketRow()] }), { pageSize: 'all' })
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
		const { rows } = await getBorrowMarketsPage(
			snapshot({ borrowMarkets: [marketRow({ intrinsic: { supply: null, borrow: intrinsicApy(0.3, 'weETH') } })] }),
			{ pageSize: 'all', apyComponents: 'base,reward,intrinsic' }
		)
		expect(rows[0]!.borrowApyIntrinsic).toBe(0.3)
	})
})

describe('getBorrowRoutesPage per-leg components', () => {
	test('emits supply/borrow base + reward for both legs', async () => {
		const { rows } = await getBorrowRoutesPage(snapshot({ borrowRoutes: [routeRow()] }), { pageSize: 'all' })
		const row = rows[0]!
		expect(row.supplyApyBase).toBe(3)
		expect(row.supplyApyReward).toBe(1)
		expect(row.borrowApyBase).toBe(2)
		expect(row.borrowApyReward).toBe(0.5)
		expect(row.supplyRewardTokensSymbols).toEqual(['ARB'])
		expect(row.borrowRewardTokensSymbols).toEqual([])
	})

	test('builds collateral and borrow token tabs in one pass with the same net APY ordering', async () => {
		const keyedRoute = (collateralId: string, borrowId: string, netApy: number) => {
			const row = routeRow({
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
		const eth = ['asset:eth']
		const result = await getBorrowRoutesForTokenKeys(
			snapshot({
				borrowRoutes: [
					keyedRoute('collateral-only', 'borrow-a', 1),
					keyedRoute('collateral-b', 'borrow-only', 3),
					keyedRoute('both-collateral', 'both-borrow', 2)
				],
				tokenKeys: [
					{ id: 'collateral-only', reference_asset: eth },
					{ id: 'borrow-only', borrow_token: eth },
					{ id: 'both-collateral', reference_asset: eth },
					{ id: 'both-borrow', borrow_token: eth }
				]
			}),
			eth
		)
		expect(result.useAsCollateral.map((row) => row.id)).toEqual([
			'both-collateral:both-borrow',
			'collateral-only:borrow-a'
		])
		expect(result.borrowThis.map((row) => row.id)).toEqual(['collateral-b:borrow-only', 'both-collateral:both-borrow'])
	})
})

describe('airdrop raise-valuation stamping', () => {
	test('stamps the valuation on an airdrop market/route/loop row', async () => {
		serveRaise('Aave V3', '25')
		const data = snapshot({ borrowMarkets: [marketRow()], borrowRoutes: [routeRow()], loops: [loopRow()] })
		expect((await getBorrowMarketsPage(data, { pageSize: 'all' })).rows[0]!.raiseValuationUsd).toBe(25_000_000)
		expect((await getBorrowRoutesPage(data, { pageSize: 'all' })).rows[0]!.raiseValuationUsd).toBe(25_000_000)
		expect((await getLoopsPage(data, { pageSize: 'all' })).rows[0]!.raiseValuationUsd).toBe(25_000_000)
	})

	test('never stamps a valuation on a non-airdrop row (protocol has a token)', async () => {
		serveRaise('Aave V3', '25')
		const { rows } = await getBorrowMarketsPage(snapshot({ borrowMarkets: [marketRow()], meta: airdropMeta(false) }), {
			pageSize: 'all'
		})
		expect(rows[0]!.airdrop).toBe(false)
		expect(rows[0]!.raiseValuationUsd ?? null).toBeNull()
	})
})

describe('borrow and loops prepared pages', () => {
	test('slices consecutive borrow market pages from one sorted table', async () => {
		const data = snapshot({
			borrowMarkets: [marketRow({ id: 'a', total_supply_usd: 2000 }), marketRow({ id: 'b' })]
		})

		const first = await getBorrowMarketsPage(data, { pageSize: '1' })
		const second = await getBorrowMarketsPage(data, { page: '2', pageSize: '1' })

		expect(first.rows.map((row) => row.id)).toEqual(['a'])
		expect(second.rows.map((row) => row.id)).toEqual(['b'])
	})

	test('applies a new filter after the unfiltered loops table was served', async () => {
		const data = snapshot({ loops: [loopRow()] })

		expect((await getLoopsPage(data, { pageSize: '25' })).rows).toHaveLength(1)
		expect((await getLoopsPage(data, { minAvailable: '10000' })).rows).toEqual([])
	})
})

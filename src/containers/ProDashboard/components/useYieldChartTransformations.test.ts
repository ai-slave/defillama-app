import { describe, expect, it } from 'vitest'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import { normalizeYieldChartType } from '../types'
import { buildProBorrowHistorySeries, buildProSupplyHistorySeries } from './useYieldChartTransformations'

const supplyHistory: PoolHistory = [
	{
		date: '2026-01-02',
		tvl_usd: 1_000,
		apy: {
			avg_1d: { base: 3, reward: 1, total: 4 },
			avg_7d: { base: 2.5, reward: 1, total: 3.5 },
			avg_30d: { base: 2, reward: 1, total: 3 }
		},
		intrinsic: {
			apy: { avg_1d: { base: 0.5 }, avg_7d: { base: 0.5 }, avg_30d: { base: 0.5 } }
		},
		price_per_share: null
	}
]

const borrowHistory: BorrowMarketHistory = [
	{
		date: '2026-01-02',
		total_borrow_usd: 400,
		available_borrow_usd: 600,
		borrow_cost_apy: {
			avg_1d: { base: 6, reward: 1, total: 5 },
			avg_7d: { base: 5, reward: 1, total: 4 },
			avg_30d: { base: 4, reward: 1, total: 3 }
		},
		intrinsic: null
	}
]

describe('Pro Yields V2 chart transforms', () => {
	it('uses served APY windows and adds intrinsic supply yield', () => {
		const series = buildProSupplyHistorySeries(supplyHistory)
		expect(series.tvlApyData[0]).toMatchObject({ TVL: 1_000, APY: 4.5 })
		expect(series.supplyApyBarData[0]).toMatchObject({ Base: 3, Reward: 1, Intrinsic: 0.5 })
		expect(series.supplyApy7dData[0][1]).toBe(4)
	})

	it('keeps borrow cost positive and renders rewards as a negative offset', () => {
		const series = buildProBorrowHistorySeries(borrowHistory)
		expect(series.borrowApyBarData[0]).toMatchObject({ 'Base cost': 6, 'Reward offset': -1 })
		expect(series.netBorrowApyData[0][1]).toBe(5)
	})

	it('maps unsupported saved liquidity charts to the V2 borrow-cost view', () => {
		expect(normalizeYieldChartType('pool-liquidity')).toBe('borrow-apy')
		expect(normalizeYieldChartType(undefined)).toBe('tvl-apy')
	})

	it('does not manufacture an APY composition series from all-null components', () => {
		const point = structuredClone(supplyHistory[0])
		point.apy.avg_1d = { base: null, reward: null, total: null }
		point.intrinsic = null
		expect(buildProSupplyHistorySeries([point]).supplyApyBarData).toEqual([])
	})
})

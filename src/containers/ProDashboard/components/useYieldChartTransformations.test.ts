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
			apy: {
				avg_1d: { base: 0.5 },
				avg_7d: { base: 0.5 },
				avg_30d: { base: 0.5 }
			}
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
		expect(series.tvlApyDataset).toEqual({
			dimensions: ['timestamp', 'APY', 'TVL'],
			source: [[Date.UTC(2026, 0, 2), 4.5, 1_000]]
		})
		expect(series.supplyApyDataset).toEqual({
			dimensions: ['timestamp', 'Base', 'Reward', 'Intrinsic'],
			source: [[Date.UTC(2026, 0, 2), 3, 1, 0.5]]
		})
		expect(series.supplyApy7dDataset).toEqual({
			dimensions: ['timestamp', '7d Supply APY'],
			source: [[Date.UTC(2026, 0, 2), 4]]
		})
	})

	it('keeps borrow cost positive and renders rewards as a negative offset', () => {
		const series = buildProBorrowHistorySeries(borrowHistory)
		expect(series.borrowApyDataset).toEqual({
			dimensions: ['timestamp', 'Base cost', 'Reward offset', 'Intrinsic'],
			source: [[Date.UTC(2026, 0, 2), 6, -1, null]]
		})
		expect(series.netBorrowApyDataset).toEqual({
			dimensions: ['timestamp', 'Net borrow cost'],
			source: [[Date.UTC(2026, 0, 2), 5]]
		})
	})

	it('maps unsupported saved liquidity charts to the V2 borrow-cost view', () => {
		expect(normalizeYieldChartType('pool-liquidity')).toBe('borrow-apy')
		expect(normalizeYieldChartType(undefined)).toBe('tvl-apy')
	})

	it('does not manufacture an APY composition series from all-null components', () => {
		const point = structuredClone(supplyHistory[0])
		point.apy.avg_1d = { base: null, reward: null, total: null }
		point.intrinsic = null
		expect(buildProSupplyHistorySeries([point]).supplyApyDataset.source).toEqual([])
	})

	it('keeps a missing borrow reward null instead of manufacturing a negative offset', () => {
		const point = structuredClone(borrowHistory[0])
		point.borrow_cost_apy.avg_1d.reward = null
		expect(buildProBorrowHistorySeries([point]).borrowApyDataset.source[0][2]).toBeNull()
	})

	it('applies time bounds before adding points to every canonical dataset', () => {
		const afterHistory = Math.floor(Date.UTC(2026, 0, 3) / 1000)
		const supply = buildProSupplyHistorySeries(supplyHistory, {
			start: afterHistory,
			end: Infinity
		})
		const borrow = buildProBorrowHistorySeries(borrowHistory, {
			start: afterHistory,
			end: Infinity
		})

		expect(supply.tvlApyDataset.source).toEqual([])
		expect(supply.supplyApyDataset.source).toEqual([])
		expect(supply.supplyApy7dDataset.source).toEqual([])
		expect(borrow.borrowApyDataset.source).toEqual([])
		expect(borrow.netBorrowApyDataset.source).toEqual([])
	})
})

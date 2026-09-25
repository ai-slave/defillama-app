import { describe, expect, test } from 'vitest'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import { normalizeYieldChartType } from '../../types'
import { buildProYieldChartSeries } from '../useYieldChartTransformations'

const supplyHistory: PoolHistory = [
	{
		date: '2026-01-02',
		tvl_usd: 1000,
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
	test('maps unsupported saved liquidity charts to the V2 borrow-cost view', () => {
		expect(normalizeYieldChartType('pool-liquidity')).toBe('borrow-apy')
		expect(normalizeYieldChartType(undefined)).toBe('tvl-apy')
	})

	test('builds only the requested canonical dataset for all five chart types', () => {
		const expected = {
			'tvl-apy': {
				dimensions: ['timestamp', 'APY', 'TVL'],
				source: [[Date.UTC(2026, 0, 2), 4.5, 1000]]
			},
			'supply-apy': {
				dimensions: ['timestamp', 'Base', 'Reward', 'Intrinsic'],
				source: [[Date.UTC(2026, 0, 2), 3, 1, 0.5]]
			},
			'supply-apy-7d': {
				dimensions: ['timestamp', '7d Supply APY'],
				source: [[Date.UTC(2026, 0, 2), 4]]
			},
			'borrow-apy': {
				dimensions: ['timestamp', 'Base cost', 'Reward offset', 'Intrinsic'],
				source: [[Date.UTC(2026, 0, 2), 6, -1, null]]
			},
			'net-borrow-apy': {
				dimensions: ['timestamp', 'Net borrow cost'],
				source: [[Date.UTC(2026, 0, 2), 5]]
			}
		} as const

		for (const chartType of Object.keys(expected) as Array<keyof typeof expected>) {
			expect(buildProYieldChartSeries({ chartType, chartData: supplyHistory, borrowData: borrowHistory })).toEqual(
				expected[chartType]
			)
		}
	})

	test('does not manufacture an APY composition series from all-null components', () => {
		const point = structuredClone(supplyHistory[0]!)
		point.apy.avg_1d = { base: null, reward: null, total: null }
		point.intrinsic = null
		expect(
			buildProYieldChartSeries({ chartType: 'supply-apy', chartData: [point], borrowData: borrowHistory }).source
		).toEqual([])
		expect(buildProYieldChartSeries({ chartType: 'tvl-apy', chartData: [point], borrowData: borrowHistory })).toEqual({
			dimensions: ['timestamp', 'APY', 'TVL'],
			source: [[Date.UTC(2026, 0, 2), null, 1000]]
		})
	})

	test('keeps intrinsic APY when the primary total is unknown', () => {
		const point = structuredClone(supplyHistory[0]!)
		point.apy.avg_1d = { base: null, reward: null, total: null }
		expect(buildProYieldChartSeries({ chartType: 'tvl-apy', chartData: [point], borrowData: [] }).source).toEqual([
			[Date.UTC(2026, 0, 2), 0.5, 1000]
		])
	})

	test('keeps a missing borrow reward null instead of manufacturing a negative offset', () => {
		const point = structuredClone(borrowHistory[0]!)
		point.borrow_cost_apy.avg_1d.reward = null
		expect(
			buildProYieldChartSeries({ chartType: 'borrow-apy', chartData: supplyHistory, borrowData: [point] })
				.source[0]?.[2]
		).toBeNull()
	})

	test('omits gap-only supply and borrow lines without manufacturing zeroes', () => {
		const supplyPoint = structuredClone(supplyHistory[0]!)
		supplyPoint.apy.avg_7d.total = null
		supplyPoint.intrinsic = null
		const borrowPoint = structuredClone(borrowHistory[0]!)
		borrowPoint.borrow_cost_apy.avg_1d = { base: null, reward: null, total: null }

		expect(
			buildProYieldChartSeries({ chartType: 'supply-apy-7d', chartData: [supplyPoint], borrowData: [] }).source
		).toEqual([])
		expect(
			buildProYieldChartSeries({ chartType: 'borrow-apy', chartData: [], borrowData: [borrowPoint] }).source
		).toEqual([])
		expect(
			buildProYieldChartSeries({ chartType: 'net-borrow-apy', chartData: [], borrowData: [borrowPoint] }).source
		).toEqual([])
	})

	test('applies time bounds before adding points to every canonical dataset', () => {
		const afterHistory = Math.floor(Date.UTC(2026, 0, 3) / 1000)
		for (const chartType of ['tvl-apy', 'supply-apy', 'supply-apy-7d', 'borrow-apy', 'net-borrow-apy'] as const) {
			expect(
				buildProYieldChartSeries({
					chartType,
					chartData: supplyHistory,
					borrowData: borrowHistory,
					bounds: { start: afterHistory, end: Infinity }
				}).source
			).toEqual([])
		}
	})
})

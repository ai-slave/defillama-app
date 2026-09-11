import { describe, expect, test } from 'vitest'
import { buildBorrowChart, buildSupplyChart, hasDrawableDay, stripVerifiedSeries } from './poolCharts'
import type { BorrowMarketHistoryPoint, PoolHistoryPoint } from './types'

function apy(base: number | null, reward: number | null, total: number | null) {
	return { base, reward, total }
}

describe('pool chart models', () => {
	test('preserves supply component gaps and dollar magnitudes', () => {
		const series: Array<PoolHistoryPoint> = [
			{
				date: '2026-01-01',
				tvl_usd: 100,
				apy: { avg_1d: apy(1, 2, 3), avg_7d: apy(4, 5, 9), avg_30d: apy(6, 7, 13) },
				intrinsic: null,
				price_per_share: null
			},
			{
				date: '2026-01-02',
				tvl_usd: null,
				apy: { avg_1d: apy(null, 3, 3), avg_7d: apy(null, 6, 6), avg_30d: apy(null, 8, 8) },
				intrinsic: {
					apy: { avg_1d: { base: 0.5 }, avg_7d: { base: 0.6 }, avg_30d: { base: 0.7 } }
				},
				price_per_share: null
			}
		]

		const model = buildSupplyChart(series)
		expect(model?.dates).toEqual([Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)])
		expect(model?.bars.map((bar) => [bar.key, bar.values, bar.avg7, bar.avg30])).toEqual([
			['base', [1, null], [4, null], [6, null]],
			['reward', [2, 3], [5, 6], [7, 8]],
			['intrinsic', [null, 0.5], [null, 0.6], [null, 0.7]]
		])
		expect(model?.lines[0]?.values).toEqual([100, null])
	})

	test('stacks the verified base on measured days and the reported base on the others', () => {
		const series: Array<PoolHistoryPoint> = [
			{
				date: '2023-12-03',
				tvl_usd: 1000,
				apy: { avg_1d: apy(3.5, null, 3.5), avg_7d: apy(3.6, null, 3.6), avg_30d: apy(3.7, null, 3.7) },
				intrinsic: null,
				price_per_share: null,
				verified: {
					apy: { avg_1d: 3.55, avg_7d: 3.6, avg_30d: 3.7 },
					price_per_share: 1.1,
					liquidity_available: null,
					liquidity_available_usd: null,
					tvl: null,
					tvl_usd: null,
					exit: { outcome: 'delayed' }
				}
			},
			{
				date: '2023-12-04',
				tvl_usd: null,
				apy: {
					avg_1d: apy(null, null, null),
					avg_7d: apy(null, null, null),
					avg_30d: apy(null, null, null)
				},
				intrinsic: null,
				price_per_share: null,
				verified: {
					apy: { avg_1d: 3.8, avg_7d: 3.7, avg_30d: 3.65 },
					price_per_share: 1.101,
					liquidity_available: null,
					liquidity_available_usd: null,
					tvl: null,
					tvl_usd: null,
					exit: { outcome: 'delayed' }
				}
			},
			// The running day: reported rates exist, the measurement completes tomorrow.
			{
				date: '2023-12-05',
				tvl_usd: 1000,
				apy: { avg_1d: apy(3.6, null, 3.6), avg_7d: apy(3.6, null, 3.6), avg_30d: apy(3.7, null, 3.7) },
				intrinsic: null,
				price_per_share: null,
				verified: {
					apy: { avg_1d: null, avg_7d: null, avg_30d: null },
					price_per_share: 1.102,
					liquidity_available: null,
					liquidity_available_usd: null,
					tvl: null,
					tvl_usd: null,
					exit: { outcome: 'delayed' }
				}
			}
		]

		const model = buildSupplyChart(series)
		expect(model?.bars.map((bar) => bar.key)).toEqual(['verifiedApy', 'base'])
		expect(model?.bars[0]).toMatchObject({
			label: 'Verified Base',
			replaces: 'base',
			values: [3.55, 3.8, null],
			avg7: [3.6, 3.7, null],
			avg30: [3.7, 3.65, null]
		})
		// The reported base keeps every day; the chart draws one base at a time.
		expect(model?.bars[1]?.values).toEqual([3.5, null, 3.6])
		expect(model?.lines.map((line) => line.key)).toEqual(['magnitude'])

		// A reader whose access ended sees the public build's bars; an unmeasured model is untouched.
		const reported = stripVerifiedSeries(model!)
		expect(reported.bars.map((bar) => bar.key)).toEqual(['base'])
		expect(reported.bars[0]?.values).toEqual([3.5, null, 3.6])
		expect(stripVerifiedSeries(reported)).toBe(reported)
	})

	test('preserves borrow components, net averages, and liquidity series', () => {
		const series: Array<BorrowMarketHistoryPoint> = [
			{
				date: '2026-01-01',
				total_borrow_usd: 40,
				available_borrow_usd: 60,
				borrow_cost_apy: { avg_1d: apy(5, 1, 4), avg_7d: apy(6, 1, 5), avg_30d: apy(7, 1, 6) },
				intrinsic: null
			}
		]

		const model = buildBorrowChart(series)
		expect(model?.bars.map((bar) => [bar.key, bar.sign, bar.values])).toEqual([
			['baseCost', 1, [5]],
			['rewardOffset', -1, [1]]
		])
		expect(model?.lines.map((line) => line.values)).toEqual([[40], [60]])
		expect(model?.netLine).toMatchObject({ values: [4], avg7: [5], avg30: [6] })
	})

	test('a stand-in whose only reading landed today has no drawable day', () => {
		const day = 86_400_000
		const today = 20_000 * day
		const dates = [today - 2 * day, today - day, today]
		const bar = {
			key: 'verifiedApy',
			label: 'Verified Base',
			colorKey: 'verified' as const,
			replaces: 'base',
			values: [null, null, 3.5],
			avg7: [],
			avg30: []
		}
		expect(hasDrawableDay(bar, dates, today)).toBe(false)
		expect(hasDrawableDay({ ...bar, values: [null, 3.4, 3.5] }, dates, today)).toBe(true)
	})
})

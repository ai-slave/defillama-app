import { describe, expect, it } from 'vitest'
import { buildBorrowChart, buildSupplyChart } from './poolCharts'
import type { BorrowMarketHistoryPoint, PoolHistoryPoint } from './types'

function apy(base: number | null, reward: number | null, total: number | null) {
	return { base, reward, total }
}

describe('pool chart models', () => {
	it('preserves supply component gaps and dollar magnitudes', () => {
		const series: PoolHistoryPoint[] = [
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
		expect(model?.lines[0].values).toEqual([100, null])
	})

	it('preserves borrow components, net averages, and liquidity series', () => {
		const series: BorrowMarketHistoryPoint[] = [
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
})

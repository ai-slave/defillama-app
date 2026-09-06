import { describe, expect, test } from 'vitest'
import type { PoolHistory } from '~/containers/Yields/poolDetail/types'
import { extractYieldsV2HistoryRows } from '../chart-datasets'

describe('extractYieldsV2HistoryRows', () => {
	test('flattens every served supply APY window without inventing change metrics', () => {
		const history: PoolHistory = [
			{
				date: '2026-01-02',
				tvl_usd: 1000,
				apy: {
					avg_1d: { base: 3, reward: 1, total: 4 },
					avg_7d: { base: 2.5, reward: 1, total: 3.5 },
					avg_30d: { base: 2, reward: 1, total: 3 }
				},
				intrinsic: {
					apy: { avg_1d: { base: 0.5 }, avg_7d: { base: 0.4 }, avg_30d: { base: 0.3 } }
				},
				price_per_share: 1.02
			}
		]

		expect(extractYieldsV2HistoryRows(history)[0]).toEqual({
			date: '2026-01-02',
			tvlUsd: 1000,
			supplyApy: 4,
			supplyApyBase: 3,
			supplyApyReward: 1,
			supplyApyIntrinsic: 0.5,
			supplyApy7d: 3.5,
			supplyApyBase7d: 2.5,
			supplyApyReward7d: 1,
			supplyApyIntrinsic7d: 0.4,
			supplyApy30d: 3,
			supplyApyBase30d: 2,
			supplyApyReward30d: 1,
			supplyApyIntrinsic30d: 0.3,
			pricePerShare: 1.02
		})
	})
})

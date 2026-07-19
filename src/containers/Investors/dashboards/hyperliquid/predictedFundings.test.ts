import { describe, expect, it } from 'vitest'
import { buildPredictedFundings } from '~/pages/api/public/hyperliquid/predicted-fundings'

describe('buildPredictedFundings', () => {
	it('uses each venue settlement interval from the live API contract', () => {
		const [result] = buildPredictedFundings([
			[
				'BTC',
				[
					['BinPerp', { fundingRate: '0.0001', nextFundingTime: 1_800_000_000_000, fundingIntervalHours: 4 }],
					['HlPerp', { fundingRate: '0.0001', nextFundingTime: 1_800_000_000_001, fundingIntervalHours: 1 }],
					['BybitPerp', null]
				]
			]
		])

		expect(result.hlRate).toBeCloseTo(87.6)
		expect(result.binanceRate).toBeCloseTo(21.9)
		expect(result.bybitRate).toBeNull()
		expect(result.nextFundingTime).toBe(1_800_000_000_001)
	})
})

import { describe, expect, it } from 'vitest'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { buildChainShareTotals, getChainMetricShare } from './chainShares'

function chain(name: string, totalFees24h: number | null): ChainsDatasetRow {
	return {
		name,
		icon: '',
		protocols: 0,
		deprecated: false,
		users: null,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		tvl: 1,
		stablesMcap: null,
		totalVolume24h: null,
		totalVolume7d: null,
		totalVolume30d: null,
		totalFees24h,
		totalFees7d: null,
		totalFees30d: null,
		totalRevenue24h: null,
		totalRevenue7d: null,
		totalRevenue30d: null,
		totalAppRevenue24h: null,
		totalAppRevenue7d: null,
		totalAppRevenue30d: null,
		bridgedTvl: null,
		mcaptvl: null,
		nftVolume: null,
		mcap: null,
		symbol: null,
		extraTvl: null
	}
}

describe('chain metric shares', () => {
	it('uses the algebraic canonical total so signed contributions sum to 100%', () => {
		const totals = buildChainShareTotals([chain('Positive', 100), chain('Adjustment', -20), chain('Unknown', null)])

		expect(totals.totalFees24h).toBe(80)
		expect(getChainMetricShare(100, totals.totalFees24h)).toBe(125)
		expect(getChainMetricShare(-20, totals.totalFees24h)).toBe(-25)
	})

	it('preserves measured zero and keeps null or non-positive denominators unavailable', () => {
		expect(getChainMetricShare(0, 10)).toBe(0)
		expect(getChainMetricShare(null, 10)).toBeNull()
		expect(getChainMetricShare(0, 0)).toBeNull()
		expect(getChainMetricShare(-1, -1)).toBeNull()
	})
})

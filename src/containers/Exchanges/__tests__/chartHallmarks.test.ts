import { describe, expect, it } from 'vitest'
import { collectionHallmarks, hallmarkMetricsForKeys } from '../chartHallmarks'

const day = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)

describe('hallmarkMetricsForKeys', () => {
	// Series keys carry the metric family in their name, so a chart never has to restate
	// what it is plotting just to get the right notes.
	it('reads the metric family out of the series key', () => {
		expect(hallmarkMetricsForKeys(['total_linear_perp_oi'])).toEqual(['oi'])
		expect(hallmarkMetricsForKeys(['cex_spot_active_liquidity'])).toEqual(['liquidity'])
		expect(hallmarkMetricsForKeys(['total_spot_volume'])).toEqual(['volume'])
		expect(hallmarkMetricsForKeys(['spot_depth_2pct'])).toEqual(['depth'])
	})

	// active_liquidity contains both "liquidity" and, in some keys, "depth": the
	// liquidity reading has to win or the note would be attached twice.
	it('classifies each key once', () => {
		expect(hallmarkMetricsForKeys(['spot_active_liquidity', 'linear_perp_active_liquidity'])).toEqual(['liquidity'])
		expect(hallmarkMetricsForKeys([])).toEqual([])
	})
})

describe('collectionHallmarks', () => {
	it('marks the day OI coverage widened, for OI charts only', () => {
		expect(collectionHallmarks(['oi'])).toEqual([[day('2026-04-24'), 'OI coverage widened']])
		expect(collectionHallmarks(['volume'])).toEqual([])
	})

	it('marks the depth coverage change for liquidity and depth charts', () => {
		expect(collectionHallmarks(['liquidity'])).toEqual([[day('2026-07-10'), 'Depth coverage widened']])
		expect(collectionHallmarks(['depth'])).toEqual([[day('2026-07-10'), 'Depth coverage widened']])
	})

	it('returns every relevant note, oldest first, and nothing for no metrics', () => {
		expect(collectionHallmarks(['oi', 'liquidity']).map(([, label]) => label)).toEqual([
			'OI coverage widened',
			'Depth coverage widened'
		])
		expect(collectionHallmarks([])).toEqual([])
	})
})

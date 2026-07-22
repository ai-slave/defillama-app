import { describe, expect, it } from 'vitest'
import { buildRWAAssetChartDataset, normalizeRWAChartMetricRows, toUnixMsTimestamp } from '../api'

describe('RWA api timestamp normalization', () => {
	it('keeps unix seconds versus milliseconds behavior unchanged', () => {
		expect(toUnixMsTimestamp(1_774_483_200)).toBe(1_774_483_200_000)
		expect(toUnixMsTimestamp(1_774_483_200_000)).toBe(1_774_483_200_000)
	})
})

describe('RWA metric history normalization', () => {
	it('normalizes only the requested metric and preserves sparse, zero, and negative values', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [
						{ timestamp: 1_000, Alpha: 0, Beta: -4 },
						{ timestamp: 2_000, Alpha: 5 }
					],
					onChainMcap: [{ timestamp: 1_000, Alpha: 100 }],
					defiActiveTvl: []
				},
				'activeMcap'
			)
		).toEqual([
			{ timestamp: 1_000_000, Alpha: 0, Beta: -4 },
			{ timestamp: 2_000_000, Alpha: 5 }
		])
	})

	it('returns an empty history for a missing selected metric', () => {
		expect(
			normalizeRWAChartMetricRows({ activeMcap: [], onChainMcap: [], defiActiveTvl: [] }, 'defiActiveTvl')
		).toEqual([])
	})
})

describe('RWA asset chart construction', () => {
	it('constructs the canonical positional history once while preserving gaps, negatives, and duplicate timestamps', () => {
		expect(
			buildRWAAssetChartDataset([
				{ timestamp: 1_000, defiActiveTvl: null, activeMcap: -2, onChainMcap: 0 },
				{ timestamp: 1_000, defiActiveTvl: 3, activeMcap: 4, onChainMcap: null }
			])
		).toEqual({
			dimensions: ['timestamp', 'DeFi Active TVL', 'Active Mcap', 'Onchain Mcap'],
			source: [
				[1_000_000, null, -2, 0],
				[1_000_000, 3, 4, null]
			]
		})
	})
})

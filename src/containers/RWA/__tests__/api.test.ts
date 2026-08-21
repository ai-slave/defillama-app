import { describe, expect, it } from 'vitest'
import { buildRWAAssetChartDataset, normalizeRWAChartMetricRows, rwaUnixSecondsToMilliseconds } from '../api'

describe('RWA api timestamp normalization', () => {
	it("converts the API's unix-second timestamps to milliseconds", () => {
		expect(rwaUnixSecondsToMilliseconds(1_774_483_200)).toBe(1_774_483_200_000)
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
					defiActiveTvl: [],
					bridgeTvl: []
				},
				'activeMcap'
			)
		).toEqual([
			{ timestamp: 1_000_000, Alpha: 0, Beta: -4 },
			{ timestamp: 2_000_000, Alpha: 5 }
		])
	})

	it('returns an empty history when the selected metric has no rows', () => {
		expect(
			normalizeRWAChartMetricRows(
				{ activeMcap: [], onChainMcap: [], defiActiveTvl: [], bridgeTvl: [] },
				'defiActiveTvl'
			)
		).toEqual([])
	})

	it('subtracts the bridge portion from defiActiveTvl when includeBridgeTvl is false', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [
						{ timestamp: 1_000, Alpha: 100, Beta: 40 },
						{ timestamp: 2_000, Alpha: 10 }
					],
					bridgeTvl: [
						{ timestamp: 1_000, Alpha: 30, Beta: 30 },
						{ timestamp: 2_000, Alpha: 0 }
					]
				},
				'defiActiveTvl',
				false
			)
		).toEqual([
			{ timestamp: 1_000_000, Alpha: 70, Beta: 10 },
			{ timestamp: 2_000_000, Alpha: 10 }
		])
	})

	it('rejects an excluded history when its required bridge leg is missing', () => {
		expect(() =>
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [{ timestamp: 1_000, Alpha: 100 }]
				},
				'defiActiveTvl',
				false
			)
		).toThrow('RWA bridge TVL history is unavailable')
	})

	it('keeps defiActiveTvl unchanged when includeBridgeTvl is true (default)', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [{ timestamp: 1_000, Alpha: 100 }],
					bridgeTvl: [{ timestamp: 1_000, Alpha: 30 }]
				},
				'defiActiveTvl'
			)
		).toEqual([{ timestamp: 1_000_000, Alpha: 100 }])
	})
})

describe('RWA asset chart construction', () => {
	it('constructs the canonical positional history once while preserving gaps, negatives, and duplicate timestamps', () => {
		expect(
			buildRWAAssetChartDataset([
				{
					timestamp: 1_000,
					defiActiveTvl: null,
					activeMcap: -2,
					onChainMcap: 0,
					totalSupply: null,
					chains: {}
				},
				{
					timestamp: 1_000,
					defiActiveTvl: 3,
					activeMcap: 4,
					onChainMcap: null,
					totalSupply: 5,
					chains: {}
				}
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

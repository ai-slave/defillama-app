import { describe, expect, test } from 'vitest'
import { buildRWAAssetChartDataset, normalizeRWAChartMetricRows, rwaUnixSecondsToMilliseconds } from '../api'

describe('RWA api timestamp normalization', () => {
	test("converts the API's unix-second timestamps to milliseconds", () => {
		expect(rwaUnixSecondsToMilliseconds(1_774_483_200)).toBe(1_774_483_200_000)
	})
})

describe('RWA metric history normalization', () => {
	test('normalizes only the requested metric and preserves sparse, zero, and negative values', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [
						{ timestamp: 1000, Alpha: 0, Beta: -4 },
						{ timestamp: 2000, Alpha: 5 }
					],
					onChainMcap: [{ timestamp: 1000, Alpha: 100 }],
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

	test('returns an empty history when the selected metric has no rows', () => {
		expect(
			normalizeRWAChartMetricRows(
				{ activeMcap: [], onChainMcap: [], defiActiveTvl: [], bridgeTvl: [] },
				'defiActiveTvl'
			)
		).toEqual([])
	})

	test('subtracts the bridge portion from defiActiveTvl when includeBridgeTvl is false', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [
						{ timestamp: 1000, Alpha: 100, Beta: 40 },
						{ timestamp: 2000, Alpha: 10 }
					],
					bridgeTvl: [
						{ timestamp: 1000, Alpha: 30, Beta: 30 },
						{ timestamp: 2000, Alpha: 0 }
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

	test('rejects an excluded history when its required bridge leg is missing', () => {
		expect(() =>
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [{ timestamp: 1000, Alpha: 100 }]
				},
				'defiActiveTvl',
				false
			)
		).toThrow('RWA bridge TVL history is unavailable')
	})

	test('keeps defiActiveTvl unchanged when includeBridgeTvl is true (default)', () => {
		expect(
			normalizeRWAChartMetricRows(
				{
					activeMcap: [],
					onChainMcap: [],
					defiActiveTvl: [{ timestamp: 1000, Alpha: 100 }],
					bridgeTvl: [{ timestamp: 1000, Alpha: 30 }]
				},
				'defiActiveTvl'
			)
		).toEqual([{ timestamp: 1_000_000, Alpha: 100 }])
	})
})

describe('RWA asset chart construction', () => {
	test('constructs the canonical positional history once while preserving gaps, negatives, and duplicate timestamps', () => {
		expect(
			buildRWAAssetChartDataset([
				{
					timestamp: 1000,
					defiActiveTvl: null,
					activeMcap: -2,
					onChainMcap: 0,
					totalSupply: null,
					chains: {}
				},
				{
					timestamp: 1000,
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

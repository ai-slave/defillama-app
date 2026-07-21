import { describe, expect, it } from 'vitest'
import { buildReserveStablecoinChartData, TOTAL_STABLECOINS_SERIES_NAME } from '../reserveStablecoinChartData'

const assets = [
	{ symbol: 'USDT', pegType: 'peggedUSD', pegMechanism: 'fiat-backed' },
	{ symbol: 'USDC', pegType: 'peggedUSD', pegMechanism: 'fiat-backed' },
	{ symbol: 'DAI', pegType: 'peggedUSD', pegMechanism: 'crypto-backed' }
]

describe('buildReserveStablecoinChartData', () => {
	it('builds the four final snapshot datasets in first-seen dimension order', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { BTC: 100, USDT: 20, DAI: 5 }],
				[2_000, { USDC: 7, USDT: 3 }]
			],
			assets
		)

		expect(result.totalStablecoins?.dataset).toEqual({
			dimensions: ['timestamp', TOTAL_STABLECOINS_SERIES_NAME],
			source: [
				[1_000, 25],
				[2_000, 10]
			]
		})
		expect(result.totalStablecoins?.charts.map((chart) => chart.name)).toEqual([TOTAL_STABLECOINS_SERIES_NAME])
		const tokenDataset = result.stablecoinsByToken!.dataset
		expect(tokenDataset.dimensions).toEqual(['timestamp', 'USDT', 'DAI', 'USDC'])
		expect(tokenDataset.source.map((row) => tokenDataset.dimensions.map((_, index) => row[index]))).toEqual([
			[1_000, 20, 5, undefined],
			[2_000, 3, undefined, 7]
		])
		const mechanismDataset = result.stablecoinsByPegMechanism!.dataset
		expect(mechanismDataset.source.map((row) => mechanismDataset.dimensions.map((_, index) => row[index]))).toEqual([
			[1_000, 20, 5],
			[2_000, 10, undefined]
		])
		expect(result.stablecoinsByPegType?.dataset.source).toEqual([
			[1_000, 25],
			[2_000, 10]
		])
		expect(result.currentTotal).toBe(10)
		for (const spec of [
			result.totalStablecoins,
			result.stablecoinsByPegMechanism,
			result.stablecoinsByPegType,
			result.stablecoinsByToken
		]) {
			for (const chart of spec?.charts ?? []) expect(chart.encode.y).toBeGreaterThan(0)
		}
	})

	it('aggregates duplicate timestamps and uses the last metadata entry for duplicate symbols', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 2 }],
				[1_000, { USDT: 3 }],
				[2_000, { USDT: 4 }]
			],
			[assets[0], { symbol: 'USDT', pegType: 'peggedEUR', pegMechanism: 'algorithmic' }]
		)

		expect(result.totalStablecoins?.dataset.source).toEqual([
			[1_000, 5],
			[2_000, 4]
		])
		expect(result.stablecoinsByPegMechanism?.dataset.source).toEqual([
			[1_000, 5],
			[2_000, 4]
		])
		expect(result.pegTypesUnique).toEqual(['peggedEUR'])
	})

	it('keeps stablecoin totals and token rows when grouping metadata is empty', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { X: 1 }],
				[2_000, { X: 2 }]
			],
			[{ symbol: 'X', pegType: '', pegMechanism: '' }]
		)

		expect(result.totalStablecoins).not.toBeNull()
		expect(result.stablecoinsByToken).not.toBeNull()
		expect(result.stablecoinsByPegType).toBeNull()
		expect(result.stablecoinsByPegMechanism).toBeNull()
		expect(result.pegMechanismPieChart).toEqual([])
	})

	it('uses the latest mechanism row for the pie and summary', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 100 }],
				[2_000, { USDT: 75, DAI: 25 }]
			],
			assets
		)

		expect(result.stablecoinBreakdown).toEqual([
			{ mechanism: 'fiat-backed', value: 75, percentage: 75 },
			{ mechanism: 'crypto-backed', value: 25, percentage: 25 }
		])
		expect(result.pegMechanismPieChart).toEqual([
			{ name: 'fiat-backed', value: 75 },
			{ name: 'crypto-backed', value: 25 }
		])
	})

	it('preserves the top-ten pie limit and groups the remainder as Others', () => {
		const manyAssets = Array.from({ length: 12 }, (_, index) => ({
			symbol: `S${index}`,
			pegType: 'peggedUSD',
			pegMechanism: `mechanism-${index}`
		}))
		const values = Object.fromEntries(manyAssets.map((asset, index) => [asset.symbol, 12 - index]))
		const result = buildReserveStablecoinChartData(
			[
				[1_000, values],
				[2_000, values]
			],
			manyAssets
		)

		expect(result.pegMechanismPieChart).toEqual([
			...manyAssets.slice(0, 10).map((asset, index) => ({ name: asset.pegMechanism, value: 12 - index })),
			{ name: 'Others', value: 3 }
		])
	})
})

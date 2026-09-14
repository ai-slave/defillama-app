import { describe, expect, test } from 'vitest'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import {
	buildRwaOverviewCards,
	changeOver,
	foldRwaPerpsTotals,
	foldRwaSeriesTotal,
	getRwaRatio,
	rankRwaChainChanges,
	rankRwaDefiProtocols
} from '../cardData'

const DAY = 24 * 60 * 60 * 1000

describe('getRwaRatio', () => {
	test('is a gap on a zero or missing denominator, never zero', () => {
		expect(getRwaRatio(50, 200)).toBe(25)
		expect(getRwaRatio(50, 0)).toBeNull()
		expect(getRwaRatio(50, null)).toBeNull()
		expect(getRwaRatio(null, 200)).toBeNull()
	})
})

describe('changeOver', () => {
	const series: Array<[number, number]> = [
		[0, 100],
		[10 * DAY, 120],
		[29 * DAY, 150],
		[40 * DAY, 200]
	]

	test('compares the latest point with the point at or before the window start', () => {
		expect(changeOver(series, 30)).toEqual({ changeUsd: 80, changePct: 66.66666666666666 })
		expect(changeOver(series, 11)).toEqual({ changeUsd: 50, changePct: 33.33333333333333 })
	})

	test('is a gap when the series does not reach back that far or is empty', () => {
		expect(changeOver(series, 41)).toEqual({ changeUsd: null, changePct: null })
		expect(changeOver([], 30)).toEqual({ changeUsd: null, changePct: null })
	})

	test('reports dollars without a percent when the prior is zero', () => {
		expect(
			changeOver(
				[
					[0, 0],
					[31 * DAY, 5]
				],
				30
			)
		).toEqual({ changeUsd: 5, changePct: null })
	})
})

describe('rankRwaDefiProtocols', () => {
	const usdy = spotAsset({
		defiActiveTvl: {
			total: 300,
			breakdown: [
				['Aave V3', 200],
				['Across', 100]
			]
		},
		bridgeTvl: 100,
		bridgeTvlByProtocol: { total: 100, breakdown: [['Across', 100]] }
	})
	const buidl = spotAsset({
		canonicalMarketId: 'securitize/buidl',
		defiActiveTvl: {
			total: 250,
			breakdown: [
				['Morpho Blue', 150],
				['Aave V3', 100]
			]
		}
	})

	test('sums protocols across assets, largest first, bridges in when the toggle is on', () => {
		expect(rankRwaDefiProtocols([usdy, buidl, perpsAsset()], true)).toEqual([
			{ name: 'Aave V3', value: 300 },
			{ name: 'Morpho Blue', value: 150 },
			{ name: 'Across', value: 100 }
		])
	})

	test('leaves bridge protocols out when the toggle is off and caps the list', () => {
		expect(rankRwaDefiProtocols([usdy, buidl], false)).toEqual([
			{ name: 'Aave V3', value: 300 },
			{ name: 'Morpho Blue', value: 150 }
		])
		expect(rankRwaDefiProtocols([usdy, buidl], true, 1)).toEqual([{ name: 'Aave V3', value: 300 }])
	})
})

describe('rankRwaChainChanges', () => {
	const rows = [
		{ timestamp: 0, Ethereum: 1000, Solana: 100, BSC: 500, Base: 50, Mantle: 10, Tron: 0 },
		{ timestamp: 31 * DAY, Ethereum: 900, Solana: 200, BSC: 400, Base: 60, Mantle: 5, Tron: 20 }
	]

	test('lists the largest gains then the largest losses in dollars, percent beside them', () => {
		expect(rankRwaChainChanges(rows, { days: 30, each: 2 })).toEqual([
			{ name: 'Solana', changeUsd: 100, changePct: 100 },
			{ name: 'Tron', changeUsd: 20, changePct: null },
			{ name: 'BSC', changeUsd: -100, changePct: -20 },
			{ name: 'Ethereum', changeUsd: -100, changePct: -10 }
		])
	})

	test('is empty without a point 30 days back', () => {
		expect(rankRwaChainChanges([rows[1]!], { days: 30, each: 5 })).toEqual([])
	})
})

describe('foldRwaSeriesTotal', () => {
	test('sums every column per row and skips rows with no value', () => {
		expect(
			foldRwaSeriesTotal([
				{ timestamp: 2, a: 1, b: 2 },
				{ timestamp: 1, a: null },
				{ timestamp: 3, a: 4, b: undefined }
			])
		).toEqual([
			[2, 3],
			[3, 4]
		])
	})
})

describe('foldRwaPerpsTotals', () => {
	const dex = perpsAsset()
	const cex = perpsAsset({
		contract: 'binance:USDY',
		venueType: 'CEX',
		openInterest: 15_000,
		openInterestChange24h: 50,
		volume24h: 3000
	})

	test('sums open interest and volume over the venues the CEX toggle allows and reads the DEX share', () => {
		expect(foldRwaPerpsTotals([dex, cex, spotAsset()], true)).toEqual({
			openInterest: 20_000,
			openInterestChange24h: { current: 20_000, prior: 14_000 },
			dexShare: 25,
			volume24h: 4000
		})
		expect(foldRwaPerpsTotals([dex, cex], false)).toEqual({
			openInterest: 5000,
			openInterestChange24h: { current: 5000, prior: 4000 },
			dexShare: 100,
			volume24h: 1000
		})
	})

	test('is a gap without perps rows', () => {
		expect(foldRwaPerpsTotals([spotAsset()], true)).toEqual({
			openInterest: null,
			openInterestChange24h: { current: null, prior: null },
			dexShare: null,
			volume24h: null
		})
	})
})

describe('buildRwaOverviewCards', () => {
	test('builds the three cards with their toggle variants from the page data', () => {
		const cards = buildRwaOverviewCards({
			assets: [spotAsset(), perpsAsset()],
			chainRows: [
				{ timestamp: 0, Ethereum: 100 },
				{ timestamp: 31 * DAY, Ethereum: 150 }
			],
			openInterestRows: {
				withCex: [
					{ timestamp: 0, Hyperliquid: 10, Binance: 30 },
					{ timestamp: 31 * DAY, Hyperliquid: 20, Binance: 40 }
				],
				dexOnly: [
					{ timestamp: 0, Hyperliquid: 10 },
					{ timestamp: 31 * DAY, Hyperliquid: 20 }
				]
			}
		})
		expect(cards.defiByProtocol.withBridges).toEqual({
			value: 100_000,
			changeUsd: 50_000,
			changePct: 100,
			bars: [{ name: 'Aave', value: 100_000 }]
		})
		expect(cards.defiByProtocol.withoutBridges.bars).toEqual(cards.defiByProtocol.withBridges.bars)
		expect(cards.chainChange).toEqual({
			value: 800_000,
			changeUsd: 300_000,
			changePct: 60,
			bars: [{ name: 'Ethereum', changeUsd: 50, changePct: 50 }]
		})
		expect(cards.perpsOpenInterest.withCex).toEqual({
			value: 60,
			changePct: 50,
			series: [
				[0, 40],
				[31 * DAY, 60]
			]
		})
		expect(cards.perpsOpenInterest.dexOnly.value).toBe(20)
	})
})

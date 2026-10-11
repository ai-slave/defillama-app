import { describe, expect, test } from 'vitest'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import {
	buildRwaDefiProtocolCard,
	buildRwaOpenInterestCard,
	buildRwaSplitCard,
	changeOver,
	foldRwaPerpsTotals,
	foldRwaSeriesTotal,
	getRwaPerpsMarkets,
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

	test('skips a name with no value on either day, never reading it as zero', () => {
		expect(
			rankRwaChainChanges(
				[
					{ timestamp: 0, Ethereum: 100, 'ZKsync Lite': 50 },
					{ timestamp: 31 * DAY, Ethereum: 120, 'ZKsync Era': 80 }
				],
				{ days: 30, each: 5 }
			)
		).toEqual([{ name: 'Ethereum', changeUsd: 20, changePct: 20 }])
	})

	test('compares days that have a total, as the card total does', () => {
		expect(
			rankRwaChainChanges(
				[
					{ timestamp: 0, Ethereum: 100 },
					{ timestamp: 1 * DAY, Ethereum: null },
					{ timestamp: 32 * DAY, Ethereum: 150 },
					{ timestamp: 33 * DAY, Ethereum: null }
				],
				{ days: 31, each: 5 }
			)
		).toEqual([{ name: 'Ethereum', changeUsd: 50, changePct: 50 }])
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

	test('sums open interest and volume over the markets and reads the DEX share', () => {
		expect(foldRwaPerpsTotals([dex, cex])).toEqual({
			openInterest: 20_000,
			openInterestChange24h: { current: 20_000, prior: 14_000 },
			dexShare: 25,
			volume24h: 4000
		})
		expect(foldRwaPerpsTotals([dex])).toEqual({
			openInterest: 5000,
			openInterestChange24h: { current: 5000, prior: 4000 },
			dexShare: 100,
			volume24h: 1000
		})
	})

	test('is a gap without markets', () => {
		expect(foldRwaPerpsTotals([])).toEqual({
			openInterest: null,
			openInterestChange24h: { current: null, prior: null },
			dexShare: null,
			volume24h: null
		})
	})
})

describe('getRwaPerpsMarkets', () => {
	test('keeps the perps rows the Venue Type choice allows and drops spot rows', () => {
		const assets = [perpsAsset({ id: 'hl' }), perpsAsset({ id: 'bn', venueType: 'CEX' }), spotAsset()]
		expect(getRwaPerpsMarkets(assets, true).map((row) => row.id)).toEqual(['hl', 'bn'])
		expect(getRwaPerpsMarkets(assets, false).map((row) => row.id)).toEqual(['hl'])
	})
})

describe('buildRwaSplitCard', () => {
	test('reads the total change over 30d and ranks the names by their own change', () => {
		expect(
			buildRwaSplitCard([
				{ timestamp: 0, Hyperliquid: 100, Binance: 300 },
				{ timestamp: 31 * DAY, Hyperliquid: 250, Binance: 200 }
			])
		).toEqual({
			changeUsd: 50,
			changePct: 12.5,
			bars: [
				{ name: 'Hyperliquid', changeUsd: 150, changePct: 150 },
				{ name: 'Binance', changeUsd: -100, changePct: -33.33333333333333 }
			]
		})
	})

	test('is empty without rows', () => {
		expect(buildRwaSplitCard([])).toEqual({ changeUsd: null, changePct: null, bars: [] })
	})
})

describe('buildRwaOpenInterestCard', () => {
	test('reads the total now, its change over 30d and its line', () => {
		expect(
			buildRwaOpenInterestCard([
				{ timestamp: 0, Hyperliquid: 100, Binance: 300 },
				{ timestamp: 31 * DAY, Hyperliquid: 250, Binance: 200 }
			])
		).toEqual({
			value: 450,
			changePct: 12.5,
			series: [
				[0, 400],
				[31 * DAY, 450]
			]
		})
	})

	test('is empty without rows', () => {
		expect(buildRwaOpenInterestCard([])).toEqual({ value: null, changePct: null, series: [] })
	})
})

describe('buildRwaDefiProtocolCard', () => {
	test('reads the DeFi Active TVL of the rows it is given and its 30d change, bridges out of the bars', () => {
		const bridged = spotAsset({
			defiActiveTvl: {
				total: 150_000,
				breakdown: [
					['Aave', 100_000],
					['Across', 50_000]
				]
			},
			bridgeTvl: 50_000,
			bridgeTvlByProtocol: { total: 50_000, breakdown: [['Across', 50_000]] }
		})
		expect(buildRwaDefiProtocolCard([bridged, perpsAsset()], true)).toEqual({
			value: 150_000,
			changeUsd: 100_000,
			bars: [{ name: 'Aave', value: 100_000 }]
		})
		expect(buildRwaDefiProtocolCard([perpsAsset()], true).value).toBeNull()
	})
})

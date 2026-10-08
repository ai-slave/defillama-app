import { describe, expect, test } from 'vitest'
import { perpsAsset } from '../../table/__tests__/fixtures'
import { averageRwaWeekly, buildRwaPerpsVolumeCard, rankRwaPerpsOpenInterest, toRwaSplitRows } from '../perpsCardData'

const DAY = 24 * 60 * 60 * 1000

const gold = perpsAsset({ id: 'gold-hl', assetGroup: 'Commodities', parentPlatform: 'Hyperliquid', openInterest: 300 })
const goldCex = perpsAsset({
	id: 'gold-bn',
	assetGroup: 'Commodities',
	parentPlatform: 'Binance',
	venueType: 'CEX',
	openInterest: 100,
	fundingRate: 0.0003,
	fundingIntervalHours: 8
})
const spy = perpsAsset({
	id: 'spy-hl',
	assetGroup: 'Equities',
	parentPlatform: 'Hyperliquid',
	openInterest: 500,
	fundingRate: -0.00001,
	fundingIntervalHours: 1
})

describe('rankRwaPerpsOpenInterest', () => {
	test('sums open interest per asset group, largest first, capped, skipping markets without open interest', () => {
		expect(rankRwaPerpsOpenInterest([gold, goldCex, spy, perpsAsset({ id: 'x', openInterest: null })])).toEqual([
			{ name: 'Equities', value: 500 },
			{ name: 'Commodities', value: 400 }
		])
		expect(rankRwaPerpsOpenInterest([gold, goldCex, spy], 1)).toEqual([{ name: 'Equities', value: 500 }])
	})
})

describe('the Volume card', () => {
	const day = (n: number): [number, number] => [Date.UTC(2026, 0, n), n * 100]
	const daily = Array.from({ length: 10 }, (_, i) => day(i + 1))

	test('averages each day with the six before it, a short first week over what it has', () => {
		const series = averageRwaWeekly(daily, 10)
		expect(series[0]).toEqual([Date.UTC(2026, 0, 1), 100])
		expect(series[2]).toEqual([Date.UTC(2026, 0, 3), 200])
		expect(series[9]).toEqual([Date.UTC(2026, 0, 10), 700])
		expect(averageRwaWeekly(daily, 3)).toHaveLength(3)
	})

	test('reads the latest average and its change against a week earlier', () => {
		const card = buildRwaPerpsVolumeCard(daily)
		expect(card.value).toBe(700)
		expect(card.changePct).toBe(250)
		expect(card.series).toHaveLength(10)
		expect(buildRwaPerpsVolumeCard([])).toEqual({ value: null, changePct: null, series: [] })
	})
})

describe('toRwaSplitRows', () => {
	test('turns one series per name into rows by time, a missing point left out', () => {
		expect(
			toRwaSplitRows({
				Hyperliquid: [
					[0, 100],
					[31 * DAY, 250]
				],
				Binance: [[31 * DAY, 200]]
			})
		).toEqual([
			{ timestamp: 0, Hyperliquid: 100 },
			{ timestamp: 31 * DAY, Hyperliquid: 250, Binance: 200 }
		])
	})
})

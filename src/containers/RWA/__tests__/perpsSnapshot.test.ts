import { describe, expect, test } from 'vitest'
import type { RWAPositionalChartDataset } from '../chartDataset'
import type { IRWAPerpsMarket } from '../Perps/api.types'
import { toRWAPerpsContractOverlayRow } from '../perpsOverlay'
import {
	buildRwaPerpsRowSnapshot,
	buildRwaPerpsSnapshot,
	getRwaPerpsSnapshotLabel,
	getRwaPerpsSnapshotWindowDays
} from '../perpsSnapshot'

const DAY = 24 * 60 * 60 * 1000
const dataset: RWAPositionalChartDataset = {
	dimensions: ['timestamp', 'Total Open Interest', 'Hyperliquid', 'Lighter', 'Ostium'],
	source: [
		[0, 60, 30, 20, 10],
		[DAY, 70, 40, 25, 5],
		[2 * DAY, 90, 50, 40, null]
	]
}

describe('getRwaPerpsSnapshotWindowDays', () => {
	test('reads open interest and markets on the latest day, and volume over the picked period', () => {
		expect(getRwaPerpsSnapshotWindowDays('openInterest', 'monthly')).toBe(1)
		expect(getRwaPerpsSnapshotWindowDays('markets', 'yearly')).toBe(1)
		expect(getRwaPerpsSnapshotWindowDays('volume', 'daily')).toBe(1)
		expect(getRwaPerpsSnapshotWindowDays('volume', 'weekly')).toBe(7)
		expect(getRwaPerpsSnapshotWindowDays('volume', 'monthly')).toBe(30)
		expect(getRwaPerpsSnapshotWindowDays('volume', 'quarterly')).toBe(90)
		expect(getRwaPerpsSnapshotWindowDays('volume', 'yearly')).toBe(365)
	})

	test('names the window the slices measure', () => {
		expect(getRwaPerpsSnapshotLabel('openInterest', 'weekly')).toBe('Open Interest')
		expect(getRwaPerpsSnapshotLabel('volume', 'daily')).toBe('Volume, last 24h')
		expect(getRwaPerpsSnapshotLabel('volume', 'weekly')).toBe('Volume, last 7 days')
		expect(getRwaPerpsSnapshotLabel('volume', 'cumulative')).toBe('Volume, all time')
	})
})

describe('buildRwaPerpsSnapshot', () => {
	test('one slice per series at the latest day, largest first, without the Total or an empty member', () => {
		expect(buildRwaPerpsSnapshot(dataset, 1)).toEqual([
			{ name: 'Hyperliquid', value: 50 },
			{ name: 'Lighter', value: 40 }
		])
	})

	test('sums the last N days for a flow', () => {
		expect(buildRwaPerpsSnapshot(dataset, 2)).toEqual([
			{ name: 'Hyperliquid', value: 90 },
			{ name: 'Lighter', value: 65 },
			{ name: 'Ostium', value: 5 }
		])
	})

	test('the cumulative period sums the whole history', () => {
		expect(buildRwaPerpsSnapshot(dataset, Number.POSITIVE_INFINITY)[0]).toEqual({ name: 'Hyperliquid', value: 120 })
	})

	test('an empty dataset draws nothing', () => {
		expect(buildRwaPerpsSnapshot({ dimensions: ['timestamp'], source: [] }, 7)).toEqual([])
	})
})

describe('buildRwaPerpsRowSnapshot', () => {
	const row = (id: string, venue: string, values: Partial<IRWAPerpsMarket>) =>
		toRWAPerpsContractOverlayRow({
			id,
			contract: id,
			venue,
			venueType: venue === 'Binance' ? 'CEX' : 'DEX',
			parentPlatform: venue,
			referenceAsset: 'Gold',
			referenceAssetGroup: 'Commodities',
			assetClass: ['Commodity Perp'],
			...values
		} as IRWAPerpsMarket)
	const rows = [
		row('xyz:GOLD', 'trade[XYZ]', { openInterest: 30, volume24h: 3, volume7d: 21, volume30d: 90, volumeAllTime: 900 }),
		row('xyz:SILVER', 'trade[XYZ]', {
			openInterest: 10,
			volume24h: 1,
			volume7d: 7,
			volume30d: 30,
			volumeAllTime: null
		}),
		row('ost:GOLD', 'Ostium', { openInterest: 50, volume24h: 0, volume7d: 2, volume30d: 8, volumeAllTime: 80 }),
		row('binance:XAU', 'Binance', { openInterest: 500, volume24h: 50, volume7d: 0, volume30d: 0, volumeAllTime: 0 })
	]

	test('sums the open interest of the page rows by the Group by, largest first, CEX markets only when counted', () => {
		expect(
			buildRwaPerpsRowSnapshot(rows, { metric: 'openInterest', period: 'daily', groupBy: 'venue', includeCex: false })
		).toEqual([
			{ name: 'Ostium', value: 50 },
			{ name: 'trade[XYZ]', value: 40 }
		])
	})

	test('reads the volume window the rows carry: 24h, 7 and 30 days, all time; one slice per market under None', () => {
		const volume = (period: 'daily' | 'weekly' | 'monthly' | 'cumulative') =>
			buildRwaPerpsRowSnapshot(rows, { metric: 'volume', period, groupBy: null, includeCex: true })
		expect(volume('daily')).toEqual([
			{ name: 'binance:XAU', value: 50 },
			{ name: 'xyz:GOLD', value: 3 },
			{ name: 'xyz:SILVER', value: 1 }
		])
		expect(volume('weekly')?.[0]).toEqual({ name: 'xyz:GOLD', value: 21 })
		expect(volume('monthly')?.[0]).toEqual({ name: 'xyz:GOLD', value: 90 })
		expect(volume('cumulative')).toEqual([
			{ name: 'xyz:GOLD', value: 900 },
			{ name: 'ost:GOLD', value: 80 }
		])
	})

	test('a window the rows do not carry (quarter, year, markets) reads the history instead', () => {
		const options = { groupBy: null, includeCex: true } as const
		expect(buildRwaPerpsRowSnapshot(rows, { ...options, metric: 'volume', period: 'quarterly' })).toBeNull()
		expect(buildRwaPerpsRowSnapshot(rows, { ...options, metric: 'volume', period: 'yearly' })).toBeNull()
		expect(buildRwaPerpsRowSnapshot(rows, { ...options, metric: 'markets', period: 'daily' })).toBeNull()
	})
})

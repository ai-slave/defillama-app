import { describe, expect, test } from 'vitest'
import type { RWAOverviewDisplayRow } from '../api.types'
import type { IRWAPerpsMarket } from '../Perps/api.types'
import { foldRwaPerpsMarketHistory, toRwaPerpsHistorySeries } from '../perpsHistoryFold'
import { toRWAPerpsContractOverlayRow } from '../perpsOverlay'

const market = (id: string, venue: string, assetGroup: string, assetName: string): RWAOverviewDisplayRow =>
	toRWAPerpsContractOverlayRow({
		id,
		contract: id,
		venue,
		venueType: 'DEX',
		parentPlatform: venue,
		referenceAsset: assetName,
		referenceAssetGroup: assetGroup,
		assetClass: ['Stock Perp']
	} as IRWAPerpsMarket)

const rows = [
	market('xyz:TSLA', 'trade[XYZ]', 'Equities', 'Tesla'),
	market('xyz:GOLD', 'trade[XYZ]', 'Commodities', 'Gold'),
	market('ost:GOLD', 'Ostium', 'Commodities', 'Gold')
]
/* The per-market history as the contract-breakdown route sends it; delisted:OLD has no row on the page. */
const history = {
	dimensions: ['timestamp', 'xyz:TSLA', 'xyz:GOLD', 'ost:GOLD', 'delisted:OLD'],
	source: [
		{ timestamp: 1000, 'xyz:TSLA': 5, 'xyz:GOLD': null, 'ost:GOLD': 2, 'delisted:OLD': 9 },
		{ timestamp: 2000, 'xyz:TSLA': 6, 'xyz:GOLD': 3, 'ost:GOLD': 4, 'delisted:OLD': 9 },
		{ timestamp: 3000, 'xyz:TSLA': null, 'xyz:GOLD': null, 'ost:GOLD': null }
	]
}

describe('foldRwaPerpsMarketHistory', () => {
	test('sums the markets of the page by venue, largest group first; a day with no member value stays unknown', () => {
		expect(foldRwaPerpsMarketHistory(history, rows, 'venue', null)).toEqual({
			dimensions: ['timestamp', 'trade[XYZ]', 'Ostium'],
			source: [
				{ timestamp: 1000, 'trade[XYZ]': 5, Ostium: 2 },
				{ timestamp: 2000, 'trade[XYZ]': 9, Ostium: 4 },
				{ timestamp: 3000, 'trade[XYZ]': null, Ostium: null }
			]
		})
	})

	test('keeps only the filtered markets and names each group as the table does', () => {
		const folded = foldRwaPerpsMarketHistory(history, rows, 'baseAsset', ['xyz:GOLD', 'ost:GOLD'])
		expect(folded.dimensions).toEqual(['timestamp', 'Gold'])
		expect(folded.source.map((row) => row.Gold)).toEqual([2, 7, null])
		expect(foldRwaPerpsMarketHistory(history, rows, 'assetGroup', ['xyz:TSLA']).dimensions).toEqual([
			'timestamp',
			'Equities'
		])
	})

	test('without a Group by keeps one series per filtered market', () => {
		expect(foldRwaPerpsMarketHistory(history, rows, null, ['ost:GOLD', 'xyz:TSLA']).dimensions).toEqual([
			'timestamp',
			'xyz:TSLA',
			'ost:GOLD'
		])
	})
})

describe('toRwaPerpsHistorySeries', () => {
	test('maps each group to its known points, oldest first', () => {
		expect(toRwaPerpsHistorySeries(foldRwaPerpsMarketHistory(history, rows, 'venue', ['ost:GOLD']))).toEqual({
			Ostium: [
				[1000, 2],
				[2000, 4]
			]
		})
	})
})

import { describe, expect, test } from 'vitest'
import { getRwaFilterResetPatch } from '../filterState'
import {
	countRwaPerpsFilters,
	createRwaPerpsFilterDraft,
	filterRwaPerpsRows,
	getRwaPerpsFilterDefinitions,
	getRwaPerpsFilterPills,
	getRwaPerpsFilterQueryKeys,
	getRwaVenueTypeQueryPatch,
	readRwaVenueTypeChoice,
	serializeRwaPerpsFilterDraft
} from '../perpsFilters'
import { perpsAsset } from '../table/__tests__/fixtures'

const rows = [
	perpsAsset({
		id: 'a',
		contract: 'xyz:GOLD',
		venue: 'trade[XYZ]',
		assetName: 'Gold',
		assetClass: ['Commodity Perp'],
		assetGroup: 'Precious Metals',
		oracleProvider: 'Pyth',
		marginAsset: 'USDC',
		fundingIntervalHours: 1,
		openInterest: 300,
		volume24h: 50,
		maxLeverage: 20,
		premium: 0.001,
		takerFeeRate: 0.0005
	}),
	perpsAsset({
		id: 'b',
		contract: 'bn:NVDA',
		venue: 'Binance',
		venueType: 'CEX',
		assetName: 'NVIDIA',
		assetClass: ['Equity Perp'],
		assetGroup: 'Public Equities',
		accessModel: 'Permissioned',
		issuer: 'Binance',
		oracleProvider: null,
		marginAsset: 'USDT',
		fundingIntervalHours: 8,
		openInterest: 1000,
		volume24h: 900,
		maxLeverage: 5,
		premium: -0.002,
		takerFeeRate: null
	}),
	perpsAsset({
		id: 'c',
		contract: 'xyz:TSLA',
		venue: 'trade[XYZ]',
		assetName: 'Tesla',
		assetClass: ['Equity Perp'],
		assetGroup: 'Public Equities',
		oracleProvider: 'Pyth',
		marginAsset: 'USDC',
		fundingIntervalHours: 1,
		openInterest: 10,
		volume24h: 2,
		maxLeverage: 10,
		premium: 0,
		takerFeeRate: 0.0007
	})
]
const ids = (out: ReadonlyArray<{ id: string }>) => out.map((row) => row.id)

describe('getRwaPerpsFilterDefinitions', () => {
	const offered = (kind: Parameters<typeof getRwaPerpsFilterDefinitions>[1]) =>
		getRwaPerpsFilterDefinitions(rows, kind).map((definition) => [definition.id, definition.inline])

	test('the Perps overview offers the perps list, never a spot group, its strip filters flagged inline', () => {
		expect(offered('perpsOverview')).toEqual([
			['venueType', true],
			['venues', false],
			['oracleProviders', false],
			['marginAssets', false],
			['fundingIntervals', false],
			['assetClasses', true],
			['assetGroups', true],
			['baseAssets', true],
			['accessModels', false],
			['issuers', false],
			['openInterest', false],
			['volume24h', false],
			['maxLeverage', false],
			['fundingApr', false],
			['premium', false],
			['takerFee', false]
		])
		expect(getRwaPerpsFilterDefinitions(rows, 'perpsOverview')[1]).toMatchObject({
			kind: 'select',
			label: 'Venue',
			values: ['Binance', 'trade[XYZ]']
		})
	})

	test('every picker counts the markets each value holds, and Venue Type each choice', () => {
		const definitions = getRwaPerpsFilterDefinitions(rows, 'perpsOverview')
		expect(definitions.find((definition) => definition.id === 'assetClasses')).toMatchObject({
			counts: { 'Equity Perp': 2, 'Commodity Perp': 1 }
		})
		expect(definitions[0]).toMatchObject({ id: 'venueType', counts: { all: 3, dex: 2, cex: 1 } })
	})

	test('a venue page drops Venue and takes every other filter into the dialog', () => {
		const venue = offered('venue')
		expect(venue.map(([id]) => id)).not.toContain('venues')
		expect(venue.filter(([, inline]) => inline)).toEqual([])
		expect(venue.map(([id]) => id)).toEqual(expect.arrayContaining(['assetClasses', 'assetGroups', 'baseAssets']))
	})

	test('an underlying page drops its own base asset and asset group', () => {
		const assetPageIds = offered('perpsAsset').map(([id]) => id)
		expect(assetPageIds).not.toContain('baseAssets')
		expect(assetPageIds).not.toContain('assetGroups')
	})

	test('the Venue picker lists the venues Venue Type keeps', () => {
		const venues = (query: Record<string, string>) =>
			getRwaPerpsFilterDefinitions([...rows, { ...rows[1], id: 'd', venue: 'OKX' }], 'perpsOverview', query).find(
				(definition) => definition.id === 'venues'
			)
		expect(venues({})).toMatchObject({ values: ['Binance', 'OKX', 'trade[XYZ]'] })
		expect(venues({ includeDex: 'false' })).toMatchObject({ values: ['Binance', 'OKX'] })
		// One DEX venue left: nothing to pick.
		expect(venues({ includeCex: 'false' })).toBeUndefined()
	})

	test('a picker with one value or a range no market carries is not offered', () => {
		const one = [rows[0], { ...rows[2], takerFeeRate: null }].map((row) => ({ ...row, takerFeeRate: null }))
		const offeredIds = getRwaPerpsFilterDefinitions(one, 'perpsOverview').map((definition) => definition.id)
		expect(offeredIds).not.toContain('venues')
		expect(offeredIds).not.toContain('takerFee')
	})
})

describe('filterRwaPerpsRows', () => {
	const definitions = getRwaPerpsFilterDefinitions(rows, 'perpsOverview')

	test('a clean URL keeps every market', () => {
		expect(ids(filterRwaPerpsRows(rows, {}, definitions))).toEqual(['a', 'b', 'c'])
		expect(countRwaPerpsFilters({}, definitions)).toBe(0)
	})

	test('a venue and an oracle provider narrow the markets, Unknown standing for a missing value', () => {
		expect(ids(filterRwaPerpsRows(rows, { venues: 'trade[XYZ]' }, definitions))).toEqual(['a', 'c'])
		expect(ids(filterRwaPerpsRows(rows, { oracleProviders: 'Unknown' }, definitions))).toEqual(['b'])
		expect(ids(filterRwaPerpsRows(rows, { fundingIntervals: '8h' }, definitions))).toEqual(['b'])
	})

	test('ranges bound the market numbers; percent ranges read premium and taker fee in percent', () => {
		expect(ids(filterRwaPerpsRows(rows, { minOpenInterest: '100' }, definitions))).toEqual(['a', 'b'])
		expect(ids(filterRwaPerpsRows(rows, { minMaxLeverage: '10', maxMaxLeverage: '20' }, definitions))).toEqual([
			'a',
			'c'
		])
		expect(ids(filterRwaPerpsRows(rows, { maxPremium: '0' }, definitions))).toEqual(['b', 'c'])
		// A market without the number fails a bounded range.
		expect(ids(filterRwaPerpsRows(rows, { maxTakerFee: '0.06' }, definitions))).toEqual(['a'])
		expect(countRwaPerpsFilters({ minOpenInterest: '100', venues: 'Binance' }, definitions)).toBe(2)
	})

	test('the inline filters narrow the markets through the same engine', () => {
		expect(ids(filterRwaPerpsRows(rows, { assetClasses: 'Equity Perp' }, definitions))).toEqual(['b', 'c'])
		expect(ids(filterRwaPerpsRows(rows, { excludeAssetGroups: 'Public Equities' }, definitions))).toEqual(['a'])
		expect(countRwaPerpsFilters({ assetClasses: 'Equity Perp', venues: 'Binance' }, definitions)).toBe(2)
	})

	test('Venue Type keeps DEX and CEX, DEX only or CEX only, and counts as a filter when it narrows', () => {
		expect(ids(filterRwaPerpsRows(rows, {}, definitions))).toEqual(['a', 'b', 'c'])
		expect(ids(filterRwaPerpsRows(rows, { includeCex: 'false' }, definitions))).toEqual(['a', 'c'])
		expect(ids(filterRwaPerpsRows(rows, { includeDex: 'false' }, definitions))).toEqual(['b'])
		expect(countRwaPerpsFilters({ includeDex: 'false' }, definitions)).toBe(1)
		expect(countRwaPerpsFilters({ includeCex: 'true' }, definitions)).toBe(0)
	})

	test('each Venue Type choice writes its one key and clears the other', () => {
		for (const choice of ['all', 'dex', 'cex'] as const) {
			const query = Object.fromEntries(
				Object.entries(getRwaVenueTypeQueryPatch(choice)).filter((entry) => entry[1] != null)
			)
			expect(readRwaVenueTypeChoice(query)).toBe(choice)
		}
		expect(getRwaVenueTypeQueryPatch('all')).toEqual({ includeCex: undefined, includeDex: undefined })
	})

	test('an old link filtered by underlying keeps its filter under baseAssets', () => {
		expect(ids(filterRwaPerpsRows(rows, { baseAssets: 'NVIDIA' }, definitions))).toEqual(['b'])
	})

	test('a key the page does not read, or an empty one, counts as no filter', () => {
		expect(countRwaPerpsFilters({ platforms: 'Ondo', categories: 'Treasuries' }, definitions)).toBe(0)
		expect(countRwaPerpsFilters({ assetClasses: '' }, definitions)).toBe(0)
	})

	test('a key the page does not offer never filters invisibly', () => {
		const venueDefinitions = getRwaPerpsFilterDefinitions(rows, 'venue')
		expect(ids(filterRwaPerpsRows(rows, { venues: 'Binance' }, venueDefinitions))).toEqual(['a', 'b', 'c'])
	})
})

describe('the More filters draft', () => {
	const definitions = getRwaPerpsFilterDefinitions(rows, 'perpsOverview')

	test('opens on what the URL holds and writes back only what is set', () => {
		const draft = createRwaPerpsFilterDraft({ venues: 'Binance', minOpenInterest: '100' }, definitions)
		expect(draft.activeIds).toEqual(['venues', 'openInterest'])
		expect(draft.selectValues.venues).toEqual(['Binance'])
		expect(draft.ranges.openInterest).toEqual({ min: '100', max: '' })

		const patch = serializeRwaPerpsFilterDraft(definitions, {
			...draft,
			activeIds: ['openInterest'],
			ranges: { ...draft.ranges, openInterest: { min: '', max: '500' } }
		})
		expect(patch).toMatchObject({ venues: undefined, excludeVenues: undefined, minOpenInterest: undefined })
		expect(patch.maxOpenInterest).toBe('500')
	})

	test('pills name each set dialog filter with the keys that clear it; an inline picker shows its own', () => {
		const pills = getRwaPerpsFilterPills(
			{ venues: 'Binance', maxPremium: '0', assetClasses: 'Equity Perp' },
			definitions
		)
		expect(pills.map((pill) => [pill.definition.id, pill.clearKeys])).toEqual([
			['venues', ['venues', 'excludeVenues']],
			['premium', ['minPremium', 'maxPremium']]
		])
	})
})

test('Reset all clears the keys the page reads and keeps the view, grouping and stray keys', () => {
	const keys = getRwaPerpsFilterQueryKeys(getRwaPerpsFilterDefinitions(rows, 'perpsOverview'))
	expect(
		getRwaFilterResetPatch(
			{ venues: 'Binance', minFundingApr: '5', baseAssets: 'Gold', groupBy: 'none', platforms: 'Ondo' },
			keys
		)
	).toEqual({ venues: undefined, minFundingApr: undefined, baseAssets: undefined })
	expect(keys).toEqual(expect.arrayContaining(['includeCex', 'includeDex']))
})

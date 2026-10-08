import { describe, expect, test } from 'vitest'
import { divergingColor, HEAT_DOWN, HEAT_UP, OTHERS_COLOR } from '~/constants/colors'
import {
	buildEquitiesTreemapLeaves,
	groupEquitiesTreemapLeaves,
	prepareCompleteEquitiesTreemapCsv,
	rankEquitiesTreemapRows,
	type IEquitiesTreemapGroup
} from '../treemapData'
import type { IEquitiesListCompanyRow } from '../types'

function makeRow(overrides: Partial<IEquitiesListCompanyRow>): IEquitiesListCompanyRow {
	return {
		ticker: 'TEST',
		country: 'US',
		name: 'Test Co',
		currentPrice: null,
		volume: null,
		marketCap: null,
		circulatingMarketCap: null,
		enterpriseValue: null,
		fiftyTwoWeekHigh: null,
		fiftyTwoWeekLow: null,
		dividendYield: null,
		trailingPE: null,
		priceToRevenue: null,
		priceChangePercentage1d: null,
		priceChangePercentage7d: null,
		priceChangePercentage1m: null,
		priceChange1d: null,
		marketCapChange1d: null,
		priceToBook: null,
		enterpriseValueToEbitda: null,
		holdersYield: null,
		updatedAt: '2026-01-01T00:00:00Z',
		revenueTTM: null,
		grossProfitTTM: null,
		earningsTTM: null,
		ebitdaTTM: null,
		operatingProfitMarginTTM: null,
		holdersRevenueTTM: null,
		holderEarningsTTM: null,
		dividendsTTM: null,
		stockRepurchaseTTM: null,
		stockIssuanceTTM: null,
		stockBasedCompensationTTM: null,
		cashAndCashEquivalents: null,
		totalAssets: null,
		totalLiabilities: null,
		totalShareholdersEquity: null,
		totalDebt: null,
		circulatingSupply: null,
		totalSupply: null,
		employeeCount: null,
		sector: 'Technology',
		industry: 'Software',
		href: '/equities/test-us',
		...overrides
	}
}

function getRequiredItem<T>(items: Array<T>, index: number): T {
	const item = items[index]
	if (item === undefined) throw new Error(`Missing item ${index}`)
	return item
}

function marketCapLeaves(rows: Array<IEquitiesListCompanyRow>) {
	return buildEquitiesTreemapLeaves(rankEquitiesTreemapRows(rows, 'marketCap'), 'priceChangePercentage1d')
}

describe('rankEquitiesTreemapRows', () => {
	test('excludes rows with null, zero or negative size metric', () => {
		const rows = [
			makeRow({ ticker: 'POS', marketCap: 100 }),
			makeRow({ ticker: 'NULL', marketCap: null }),
			makeRow({ ticker: 'ZERO', marketCap: 0 }),
			makeRow({ ticker: 'NEG', marketCap: -5 })
		]
		const ranking = rankEquitiesTreemapRows(rows, 'marketCap')
		expect(ranking.rows.map((row) => row.ticker)).toEqual(['POS'])
		expect(ranking.excludedCount).toBe(3)
	})

	test('sorts rows by size metric descending', () => {
		const rows = [
			makeRow({ ticker: 'SMALL', marketCap: 10 }),
			makeRow({ ticker: 'BIG', marketCap: 1000 }),
			makeRow({ ticker: 'MID', marketCap: 100 })
		]
		expect(rankEquitiesTreemapRows(rows, 'marketCap').rows.map((row) => row.ticker)).toEqual(['BIG', 'MID', 'SMALL'])
	})

	test('keeps input order for equal sizes and treats a non-positive limit as unlimited', () => {
		const rows = [
			makeRow({ ticker: 'FIRST', marketCap: 100 }),
			makeRow({ ticker: 'SECOND', marketCap: 100 }),
			makeRow({ ticker: 'SMALL', marketCap: 10 })
		]
		const ranking = rankEquitiesTreemapRows(rows, 'marketCap', 0)
		expect(ranking.rows.map((row) => row.ticker)).toEqual(['FIRST', 'SECOND', 'SMALL'])
		expect(ranking.truncatedCount).toBe(0)
	})

	test('applies limit after sorting and reports cut rows as truncated, not excluded', () => {
		const rows = [
			makeRow({ ticker: 'A', marketCap: 1 }),
			makeRow({ ticker: 'B', marketCap: 3 }),
			makeRow({ ticker: 'C', marketCap: 2 })
		]
		const ranking = rankEquitiesTreemapRows(rows, 'marketCap', 2)
		expect(ranking.rows.map((row) => row.ticker)).toEqual(['B', 'C'])
		expect(ranking.excludedCount).toBe(0)
		expect(ranking.truncatedCount).toBe(1)
	})
})

describe('buildEquitiesTreemapLeaves', () => {
	test('builds leaf value as [size, colorPct]', () => {
		const [leaf] = marketCapLeaves([makeRow({ ticker: 'A', marketCap: 100, priceChangePercentage1d: -2.5 })])
		expect(leaf?.value).toEqual([100, -2.5])
	})

	test('prepares the exact loss, neutral and gain color scale on canonical leaves', () => {
		const leaves = marketCapLeaves([
			makeRow({ ticker: 'LOSS_CAP', marketCap: 500, priceChangePercentage1d: -3 }),
			makeRow({ ticker: 'LOSS_MID', marketCap: 400, priceChangePercentage1d: -1.5 }),
			makeRow({ ticker: 'FLAT', marketCap: 300, priceChangePercentage1d: 0 }),
			makeRow({ ticker: 'GAIN_MID', marketCap: 200, priceChangePercentage1d: 1.5 }),
			makeRow({ ticker: 'GAIN_CAP', marketCap: 100, priceChangePercentage1d: 3 })
		])
		expect(leaves.map((leaf) => leaf.itemStyle.color)).toEqual([
			HEAT_DOWN,
			divergingColor(-0.5),
			OTHERS_COLOR,
			divergingColor(0.5),
			HEAT_UP
		])
	})

	test('uses null color when color metric is missing', () => {
		const [leaf] = marketCapLeaves([makeRow({ ticker: 'A', marketCap: 100, priceChangePercentage1d: null })])
		expect(leaf?.value).toEqual([100, null])
	})

	test('respects selected size and color metrics', () => {
		const rows = [
			makeRow({ ticker: 'A', marketCap: 1, revenueTTM: 500, priceChangePercentage7d: 4 }),
			makeRow({ ticker: 'B', marketCap: 999, revenueTTM: null })
		]
		const ranking = rankEquitiesTreemapRows(rows, 'revenueTTM')
		const leaves = buildEquitiesTreemapLeaves(ranking, 'priceChangePercentage7d')
		expect(leaves.map((leaf) => [leaf.name, leaf.value])).toEqual([['A', [500, 4]]])
		expect(ranking.excludedCount).toBe(1)
	})

	test('carries tooltip fields on leaves', () => {
		const rows = [
			makeRow({
				ticker: 'NVDA',
				name: 'NVIDIA Corp',
				sector: 'Technology',
				industry: 'Semiconductors',
				marketCap: 900,
				ebitdaTTM: 60,
				priceChangePercentage1d: 1.2
			})
		]
		const [leaf] = buildEquitiesTreemapLeaves(rankEquitiesTreemapRows(rows, 'ebitdaTTM'), 'priceChangePercentage1d')
		expect(leaf).toMatchObject({
			name: 'NVDA',
			companyName: 'NVIDIA Corp',
			country: 'US',
			sector: 'Technology',
			industry: 'Semiconductors',
			marketCap: 900
		})
	})
})

describe('groupEquitiesTreemapLeaves', () => {
	test('groups leaves by sector preserving size order within groups', () => {
		const leaves = marketCapLeaves([
			makeRow({ ticker: 'T1', sector: 'Technology', marketCap: 100 }),
			makeRow({ ticker: 'H1', sector: 'Healthcare', marketCap: 300 }),
			makeRow({ ticker: 'T2', sector: 'Technology', marketCap: 400 })
		])
		const groups = groupEquitiesTreemapLeaves(leaves, 'sector') as Array<IEquitiesTreemapGroup>
		// The sector holding the largest company comes first, not alphabetical order.
		expect(groups.map((g) => g.name)).toEqual(['Technology', 'Healthcare'])
		expect(getRequiredItem(groups, 0).children.map((c) => c.name)).toEqual(['T2', 'T1'])
	})

	test('sets group value to the sum of children sizes', () => {
		const leaves = marketCapLeaves([
			makeRow({ ticker: 'T1', sector: 'Technology', marketCap: 100 }),
			makeRow({ ticker: 'T2', sector: 'Technology', marketCap: 200 })
		])
		const groups = groupEquitiesTreemapLeaves(leaves, 'sector') as Array<IEquitiesTreemapGroup>
		expect(getRequiredItem(groups, 0).value).toEqual([300, null])
	})

	test('puts companies with empty sector into Other group', () => {
		const leaves = marketCapLeaves([makeRow({ ticker: 'A', sector: '', marketCap: 100 })])
		expect(groupEquitiesTreemapLeaves(leaves, 'sector').map((g) => g.name)).toEqual(['Other'])
	})
})

describe('prepareCompleteEquitiesTreemapCsv', () => {
	test('exports every ranked company as a leaf row', () => {
		const ranking = rankEquitiesTreemapRows(
			[
				makeRow({ ticker: 'BIG', name: 'Big Co', marketCap: 200, priceChangePercentage1d: 2 }),
				makeRow({ ticker: 'SMALL', name: 'Small Co', marketCap: 100, priceChangePercentage1d: null })
			],
			'marketCap'
		)

		expect(
			prepareCompleteEquitiesTreemapCsv({
				ranking,
				colorMetric: 'priceChangePercentage1d',
				sizeLabel: 'Market Cap',
				colorLabel: 'Price 1D',
				filename: 'equities-market-map'
			})
		).toEqual({
			filename: 'equities-market-map',
			rows: [
				[
					'Ticker',
					'Company',
					'Country',
					'Sector',
					'Industry',
					'Size Metric',
					'Size',
					'Color Metric',
					'Change %',
					'Market Cap'
				],
				['BIG', 'Big Co', 'US', 'Technology', 'Software', 'Market Cap', 200, 'Price 1D', 2, 200],
				['SMALL', 'Small Co', 'US', 'Technology', 'Software', 'Market Cap', 100, 'Price 1D', '', 100]
			]
		})
	})
})

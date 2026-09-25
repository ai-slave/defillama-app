import { describe, expect, test } from 'vitest'
import {
	buildEquitiesTreemap,
	prepareEquitiesTreemapCsv,
	type IEquitiesTreemapGroup,
	type IEquitiesTreemapLeaf
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

const baseOptions = {
	groupBy: 'none',
	sizeMetric: 'marketCap',
	colorMetric: 'priceChangePercentage1d'
} as const

describe('buildEquitiesTreemap', () => {
	test('excludes rows with null, zero or negative size metric', () => {
		const rows = [
			makeRow({ ticker: 'POS', marketCap: 100 }),
			makeRow({ ticker: 'NULL', marketCap: null }),
			makeRow({ ticker: 'ZERO', marketCap: 0 }),
			makeRow({ ticker: 'NEG', marketCap: -5 })
		]
		const result = buildEquitiesTreemap(rows, baseOptions)
		expect(result.treeData.map((n) => n.name)).toEqual(['POS'])
		expect(result.excludedCount).toBe(3)
	})

	test('sorts leaves by size metric descending', () => {
		const rows = [
			makeRow({ ticker: 'SMALL', marketCap: 10 }),
			makeRow({ ticker: 'BIG', marketCap: 1000 }),
			makeRow({ ticker: 'MID', marketCap: 100 })
		]
		const result = buildEquitiesTreemap(rows, baseOptions)
		expect(result.treeData.map((n) => n.name)).toEqual(['BIG', 'MID', 'SMALL'])
	})

	test('keeps input order for equal sizes and treats a non-positive limit as unlimited', () => {
		const rows = [
			makeRow({ ticker: 'FIRST', marketCap: 100 }),
			makeRow({ ticker: 'SECOND', marketCap: 100 }),
			makeRow({ ticker: 'SMALL', marketCap: 10 })
		]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, limit: 0 })
		expect(result.treeData.map((node) => node.name)).toEqual(['FIRST', 'SECOND', 'SMALL'])
		expect(result.truncatedCount).toBe(0)
	})

	test('applies limit after sorting and reports cut rows as truncated, not excluded', () => {
		const rows = [
			makeRow({ ticker: 'A', marketCap: 1 }),
			makeRow({ ticker: 'B', marketCap: 3 }),
			makeRow({ ticker: 'C', marketCap: 2 })
		]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, limit: 2 })
		expect(result.treeData.map((n) => n.name)).toEqual(['B', 'C'])
		expect(result.excludedCount).toBe(0)
		expect(result.truncatedCount).toBe(1)
	})

	test('builds leaf value as [size, colorPct]', () => {
		const rows = [makeRow({ ticker: 'A', marketCap: 100, priceChangePercentage1d: -2.5 })]
		const result = buildEquitiesTreemap(rows, baseOptions)
		const leaf = result.treeData[0] as IEquitiesTreemapLeaf
		expect(leaf.value).toEqual([100, -2.5])
	})

	test('prepares the exact loss, neutral and gain color scale on canonical leaves', () => {
		const result = buildEquitiesTreemap(
			[
				makeRow({ ticker: 'LOSS_CAP', marketCap: 500, priceChangePercentage1d: -3 }),
				makeRow({ ticker: 'LOSS_MID', marketCap: 400, priceChangePercentage1d: -1.5 }),
				makeRow({ ticker: 'FLAT', marketCap: 300, priceChangePercentage1d: 0 }),
				makeRow({ ticker: 'GAIN_MID', marketCap: 200, priceChangePercentage1d: 1.5 }),
				makeRow({ ticker: 'GAIN_CAP', marketCap: 100, priceChangePercentage1d: 3 })
			],
			baseOptions
		)
		expect(result.leaves.map((leaf) => leaf.itemStyle.color)).toEqual([
			'rgb(148, 46, 56)',
			'rgb(159, 108, 113)',
			'#aaaaaa',
			'rgb(104, 165, 115)',
			'rgb(38, 159, 60)'
		])
	})

	test('uses null color when color metric is missing', () => {
		const rows = [makeRow({ ticker: 'A', marketCap: 100, priceChangePercentage1d: null })]
		const result = buildEquitiesTreemap(rows, baseOptions)
		const leaf = result.treeData[0] as IEquitiesTreemapLeaf
		expect(leaf.value).toEqual([100, null])
	})

	test('respects selected size and color metrics', () => {
		const rows = [
			makeRow({ ticker: 'A', marketCap: 1, revenueTTM: 500, priceChangePercentage7d: 4 }),
			makeRow({ ticker: 'B', marketCap: 999, revenueTTM: null })
		]
		const result = buildEquitiesTreemap(rows, {
			groupBy: 'none',
			sizeMetric: 'revenueTTM',
			colorMetric: 'priceChangePercentage7d'
		})
		expect(result.treeData.map((n) => n.name)).toEqual(['A'])
		expect((result.treeData[0] as IEquitiesTreemapLeaf).value).toEqual([500, 4])
		expect(result.excludedCount).toBe(1)
	})

	test('groups leaves by sector preserving size order within groups', () => {
		const rows = [
			makeRow({ ticker: 'T1', sector: 'Technology', marketCap: 100 }),
			makeRow({ ticker: 'H1', sector: 'Healthcare', marketCap: 300 }),
			makeRow({ ticker: 'T2', sector: 'Technology', marketCap: 400 })
		]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, groupBy: 'sector' })
		const groups = result.treeData as Array<IEquitiesTreemapGroup>
		// The sector holding the largest company comes first, not alphabetical order.
		expect(groups.map((g) => g.name)).toEqual(['Technology', 'Healthcare'])
		expect(getRequiredItem(groups, 0).children.map((c) => c.name)).toEqual(['T2', 'T1'])
	})

	test('sets group value to the sum of children sizes', () => {
		const rows = [
			makeRow({ ticker: 'T1', sector: 'Technology', marketCap: 100 }),
			makeRow({ ticker: 'T2', sector: 'Technology', marketCap: 200 })
		]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, groupBy: 'sector' })
		const groups = result.treeData as Array<IEquitiesTreemapGroup>
		expect(getRequiredItem(groups, 0).value).toEqual([300, null])
	})

	test('puts companies with empty sector into Other group', () => {
		const rows = [makeRow({ ticker: 'A', sector: '', marketCap: 100 })]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, groupBy: 'sector' })
		const groups = result.treeData as Array<IEquitiesTreemapGroup>
		expect(groups.map((g) => g.name)).toEqual(['Other'])
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
		const result = buildEquitiesTreemap(rows, { ...baseOptions, sizeMetric: 'ebitdaTTM' })
		const leaf = result.treeData[0] as IEquitiesTreemapLeaf
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

describe('prepareEquitiesTreemapCsv', () => {
	test('exports the displayed leaves from grouped chart data', () => {
		const { leaves } = buildEquitiesTreemap(
			[
				makeRow({ ticker: 'BIG', name: 'Big Co', marketCap: 200, priceChangePercentage1d: 2 }),
				makeRow({ ticker: 'SMALL', name: 'Small Co', marketCap: 100, priceChangePercentage1d: null })
			],
			{ ...baseOptions, groupBy: 'sector' }
		)

		expect(
			prepareEquitiesTreemapCsv({
				leaves,
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

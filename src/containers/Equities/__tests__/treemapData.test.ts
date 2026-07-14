import { describe, expect, it } from 'vitest'
import { buildEquitiesTreemap, type IEquitiesTreemapGroup, type IEquitiesTreemapLeaf } from '../treemapData'
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
		updatedAt: null,
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

const baseOptions = {
	groupBy: 'none',
	sizeMetric: 'marketCap',
	colorMetric: 'priceChangePercentage1d'
} as const

describe('buildEquitiesTreemap', () => {
	it('returns empty tree for empty input', () => {
		const result = buildEquitiesTreemap([], baseOptions)
		expect(result.treeData).toEqual([])
		expect(result.excludedCount).toBe(0)
		expect(result.truncatedCount).toBe(0)
	})

	it('excludes rows with null, zero or negative size metric', () => {
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

	it('sorts leaves by size metric descending', () => {
		const rows = [
			makeRow({ ticker: 'SMALL', marketCap: 10 }),
			makeRow({ ticker: 'BIG', marketCap: 1000 }),
			makeRow({ ticker: 'MID', marketCap: 100 })
		]
		const result = buildEquitiesTreemap(rows, baseOptions)
		expect(result.treeData.map((n) => n.name)).toEqual(['BIG', 'MID', 'SMALL'])
	})

	it('applies limit after sorting and reports cut rows as truncated, not excluded', () => {
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

	it('builds leaf value as [size, colorPct]', () => {
		const rows = [makeRow({ ticker: 'A', marketCap: 100, priceChangePercentage1d: -2.5 })]
		const result = buildEquitiesTreemap(rows, baseOptions)
		const leaf = result.treeData[0] as IEquitiesTreemapLeaf
		expect(leaf.value).toEqual([100, -2.5])
	})

	it('uses null color when color metric is missing', () => {
		const rows = [makeRow({ ticker: 'A', marketCap: 100, priceChangePercentage1d: null })]
		const result = buildEquitiesTreemap(rows, baseOptions)
		const leaf = result.treeData[0] as IEquitiesTreemapLeaf
		expect(leaf.value).toEqual([100, null])
	})

	it('respects selected size and color metrics', () => {
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

	it('groups leaves by sector preserving size order within groups', () => {
		const rows = [
			makeRow({ ticker: 'T1', sector: 'Technology', marketCap: 100 }),
			makeRow({ ticker: 'H1', sector: 'Healthcare', marketCap: 300 }),
			makeRow({ ticker: 'T2', sector: 'Technology', marketCap: 200 })
		]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, groupBy: 'sector' })
		const groups = result.treeData as IEquitiesTreemapGroup[]
		expect(groups.map((g) => g.name)).toEqual(['Healthcare', 'Technology'])
		expect(groups[1].children.map((c) => c.name)).toEqual(['T2', 'T1'])
	})

	it('sets group value to the sum of children sizes', () => {
		const rows = [
			makeRow({ ticker: 'T1', sector: 'Technology', marketCap: 100 }),
			makeRow({ ticker: 'T2', sector: 'Technology', marketCap: 200 })
		]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, groupBy: 'sector' })
		const groups = result.treeData as IEquitiesTreemapGroup[]
		expect(groups[0].value).toEqual([300, null])
	})

	it('puts companies with empty sector into Other group', () => {
		const rows = [makeRow({ ticker: 'A', sector: '', marketCap: 100 })]
		const result = buildEquitiesTreemap(rows, { ...baseOptions, groupBy: 'sector' })
		const groups = result.treeData as IEquitiesTreemapGroup[]
		expect(groups.map((g) => g.name)).toEqual(['Other'])
	})

	it('carries tooltip fields on leaves', () => {
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

import { describe, expect, it } from 'vitest'
import type { IEquitiesCompanyApiItem } from '../api.types'
import {
	buildEquitiesSnapshot,
	buildEquitiesTreemapPage,
	getEquitiesTablePage,
	prepareEquitiesRows
} from '../server/tableData.server'
import { getEquitiesTableQuery } from '../tableQuery'

function company(
	overrides: Partial<IEquitiesCompanyApiItem> & Pick<IEquitiesCompanyApiItem, 'ticker'>
): IEquitiesCompanyApiItem {
	return {
		country: 'US',
		name: `${overrides.ticker} Inc`,
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
		updatedAt: '2026-09-03T10:00:00Z',
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
		...overrides
	}
}

const companies = [
	company({ ticker: 'AAPL', name: 'Apple', marketCap: 300, volume: 5, sector: 'Technology' }),
	company({
		ticker: 'BANK',
		name: 'Big Bank',
		marketCap: 200,
		volume: null,
		sector: 'Financial Services',
		country: 'CA'
	}),
	company({ ticker: 'APLE', name: 'Apple Hospitality', marketCap: 100, volume: 9, sector: '' }),
	company({ ticker: 'ZERO', name: 'Zero Cap', marketCap: 0, volume: 1 })
]

describe('buildEquitiesSnapshot', () => {
	it('keeps producer order, links rows, collects sorted facet options and hashes content', () => {
		const snapshot = buildEquitiesSnapshot(companies, 1_000)
		expect(snapshot.rows.map((row) => row.href)).toEqual([
			'/equities/AAPL:US',
			'/equities/BANK:CA',
			'/equities/APLE:US',
			'/equities/ZERO:US'
		])
		expect(snapshot.options).toEqual({
			country: ['CA', 'US'],
			sector: ['Financial Services', 'Technology'],
			industry: ['Software']
		})
		expect(snapshot.updatedAt).toBe('2026-09-03T10:00:00Z')
		expect(snapshot.version).toBe(buildEquitiesSnapshot(companies, 2_000).version)
		expect(snapshot.version).not.toBe(buildEquitiesSnapshot(companies.slice(1), 1_000).version)
	})
})

describe('prepareEquitiesRows', () => {
	const rows = buildEquitiesSnapshot(companies, 0).rows

	it('sorts nulls last in both directions and breaks ties on identity', () => {
		expect(prepareEquitiesRows(rows, getEquitiesTableQuery({ sortBy: 'volume' })).map((row) => row.ticker)).toEqual([
			'APLE',
			'AAPL',
			'ZERO',
			'BANK'
		])
		expect(
			prepareEquitiesRows(rows, getEquitiesTableQuery({ sortBy: 'volume', sortDesc: 'false' })).map((row) => row.ticker)
		).toEqual(['ZERO', 'AAPL', 'APLE', 'BANK'])
	})

	it('ranks ticker matches ahead of company-name matches while searching', () => {
		// APLE matches on ticker, AAPL only on its name, so APLE leads despite the smaller market cap.
		expect(prepareEquitiesRows(rows, getEquitiesTableQuery({ search: 'ple' })).map((row) => row.ticker)).toEqual([
			'APLE',
			'AAPL'
		])
	})

	it('applies compact filters before sorting', () => {
		expect(
			prepareEquitiesRows(rows, getEquitiesTableQuery({ filters: 'country:out:CA;marketCap:gte:100' })).map(
				(row) => row.ticker
			)
		).toEqual(['AAPL', 'APLE'])
	})
})

describe('getEquitiesTablePage', () => {
	it('slices the prepared rows and carries snapshot facets', async () => {
		const snapshot = buildEquitiesSnapshot(companies, 0)
		const page = await getEquitiesTablePage(snapshot, { page: '2', pageSize: '3' })
		expect(page).toMatchObject({
			schemaVersion: 1,
			page: 2,
			pageSize: 3,
			total: 4,
			totalPages: 2,
			hasMore: false,
			updatedAt: '2026-09-03T10:00:00Z'
		})
		expect(page.rows.map((row) => row.ticker)).toEqual(['ZERO'])
		expect(page.options.country).toEqual(['CA', 'US'])
	})
})

describe('buildEquitiesTreemapPage', () => {
	it('returns only map fields for eligible rows ranked by the size metric', () => {
		const rows = buildEquitiesSnapshot(companies, 0).rows
		const page = buildEquitiesTreemapPage(rows, { search: '', filters: [], sizeMetric: 'volume' as never })
		expect(page.rows.map((row) => row.ticker)).toEqual(['APLE', 'AAPL', 'ZERO'])
		expect(page.excludedCount).toBe(1)
		expect(page.total).toBe(4)
		expect(Object.keys(page.rows[0])).not.toContain('href')
		expect(Object.keys(page.rows[0])).not.toContain('trailingPE')
	})

	it('applies search and filters before ranking', () => {
		const rows = buildEquitiesSnapshot(companies, 0).rows
		const page = buildEquitiesTreemapPage(rows, { search: 'apple', filters: [], sizeMetric: 'marketCap' })
		expect(page.rows.map((row) => row.ticker)).toEqual(['AAPL', 'APLE'])
		expect(page.total).toBe(2)
	})
})

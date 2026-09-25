import { describe, expect, test } from 'vitest'
import {
	buildEquitiesSnapshot,
	buildEquitiesTreemapPage,
	getEquitiesTablePage,
	prepareEquitiesRows
} from '../server/tableData.server'
import { getEquitiesTableQuery } from '../tableQuery'
import { company } from './companyFixture'

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
	test('keeps producer order, links rows, collects sorted facet options and hashes content', () => {
		const snapshot = buildEquitiesSnapshot(companies, 1000)
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
		expect(snapshot.version).toBe(buildEquitiesSnapshot(companies, 2000).version)
		expect(snapshot.version).not.toBe(buildEquitiesSnapshot(companies.slice(1), 1000).version)
	})
})

describe('prepareEquitiesRows', () => {
	const rows = buildEquitiesSnapshot(companies, 0).rows

	test('sorts nulls last in both directions and breaks ties on identity', () => {
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

	test('ranks ticker matches ahead of company-name matches while searching', () => {
		// APLE matches on ticker, AAPL only on its name, so APLE leads despite the smaller market cap.
		expect(prepareEquitiesRows(rows, getEquitiesTableQuery({ search: 'ple' })).map((row) => row.ticker)).toEqual([
			'APLE',
			'AAPL'
		])
	})

	test('applies compact filters before sorting', () => {
		expect(
			prepareEquitiesRows(rows, getEquitiesTableQuery({ filters: 'country:out:CA;marketCap:gte:100' })).map(
				(row) => row.ticker
			)
		).toEqual(['AAPL', 'APLE'])
	})
})

describe('getEquitiesTablePage', () => {
	test('slices the prepared rows and carries snapshot facets', async () => {
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

	test('serves a new sort from freshly ordered rows instead of the previous sort', async () => {
		const snapshot = buildEquitiesSnapshot(companies, 0)
		const byMarketCap = await getEquitiesTablePage(snapshot, { pageSize: '2' })
		const byVolume = await getEquitiesTablePage(snapshot, { pageSize: '2', sortBy: 'volume' })
		const byVolumePageTwo = await getEquitiesTablePage(snapshot, { page: '2', pageSize: '2', sortBy: 'volume' })
		expect(byMarketCap.rows.map((row) => row.ticker)).toEqual(['AAPL', 'BANK'])
		expect(byVolume.rows.map((row) => row.ticker)).toEqual(['APLE', 'AAPL'])
		expect(byVolumePageTwo.rows.map((row) => row.ticker)).toEqual(['ZERO', 'BANK'])
	})
})

describe('buildEquitiesTreemapPage', () => {
	test('returns only map fields for eligible rows ranked by the size metric', () => {
		const rows = buildEquitiesSnapshot(companies, 0).rows
		const page = buildEquitiesTreemapPage(rows, { search: '', filters: [], sizeMetric: 'volume' as never })
		expect(page.rows.map((row) => row.ticker)).toEqual(['APLE', 'AAPL', 'ZERO'])
		expect(page.excludedCount).toBe(1)
		expect(page.total).toBe(4)
		expect(Object.keys(page.rows[0])).not.toContain('href')
		expect(Object.keys(page.rows[0])).not.toContain('trailingPE')
	})

	test('applies search and filters before ranking', () => {
		const rows = buildEquitiesSnapshot(companies, 0).rows
		const page = buildEquitiesTreemapPage(rows, { search: 'apple', filters: [], sizeMetric: 'marketCap' })
		expect(page.rows.map((row) => row.ticker)).toEqual(['AAPL', 'APLE'])
		expect(page.total).toBe(2)
	})
})

import { describe, expect, it } from 'vitest'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensSourceRow } from '../types'
import { buildTokensSortIndexes, getTokensPageFromRows, getTokensPageQuery } from '../utils'

function row(overrides: Partial<TokensSourceRow> & Pick<TokensSourceRow, 'id' | 'name' | 'symbol'>): TokensSourceRow {
	return {
		rank: null,
		logo: null,
		href: null,
		price: null,
		priceChange1h: null,
		priceChange24h: null,
		priceChange7d: null,
		priceChange30d: null,
		marketCap: null,
		fdv: null,
		outstandingFdv: null,
		unlockedPercent: null,
		spotVolume24h: null,
		perpsVolume24h: null,
		openInterest24h: null,
		fees24h: null,
		revenue24h: null,
		holdersRevenue24h: null,
		trsPercent: null,
		rights: null,
		unlock30dUsd: null,
		upcomingUnlockUsd: null,
		searchKey: `${overrides.name} ${overrides.symbol}`.toLowerCase(),
		...overrides
	}
}

const basePage = {
	schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
	stats: {
		totalMarketCap: 0,
		marketCapWeightedChange24h: null,
		spotVolume24h: 0,
		perpsVolume24h: 0,
		openInterest24h: 0,
		unlock30dUsd: 0,
		upcomingUnlockUsd: 0
	},
	updatedAt: null
}

function getPage(rows: TokensSourceRow[], query: Record<string, string>) {
	return getTokensPageFromRows(rows, buildTokensSortIndexes(rows), query, basePage)
}

describe('getTokensPageQuery', () => {
	it('normalizes invalid query params to defaults', () => {
		expect(
			getTokensPageQuery({
				page: '0',
				pageSize: 'bad',
				sortBy: 'bad',
				sortDesc: 'maybe',
				category: 'not-real',
				search: '  ethena  '
			})
		).toEqual({
			page: 1,
			pageSize: 20,
			sortBy: 'marketCap',
			sortDesc: true,
			search: 'ethena'
		})
	})

	it('caps oversized page sizes and accepts supported sort params', () => {
		expect(
			getTokensPageQuery({
				page: '3',
				pageSize: '9999',
				sortBy: 'priceChange7d',
				sortDesc: 'false',
				category: 'dexs'
			})
		).toEqual({
			page: 3,
			pageSize: 500,
			sortBy: 'priceChange7d',
			sortDesc: false,
			search: ''
		})
	})
})

describe('getTokensPageFromRows', () => {
	const rows = [
		row({ id: 'ethena', name: 'Ethena', symbol: 'ENA', marketCap: 900 }),
		row({ id: 'uniswap', name: 'Uniswap', symbol: 'UNI', marketCap: 1200 }),
		row({ id: 'aave', name: 'Aave', symbol: 'AAVE', marketCap: 800 }),
		row({ id: 'curve', name: 'Curve', symbol: 'CRV', marketCap: 800 })
	]

	it('filters by search before sorting and pagination', () => {
		const result = getPage(rows, {
			search: 'uni',
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap'])
		expect(result.total).toBe(1)
		expect(result.hasMore).toBe(false)
	})

	it('ignores stale category params', () => {
		const result = getPage(rows, {
			category: 'dexs',
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap', 'ethena', 'aave', 'curve'])
		expect(result.total).toBe(4)
	})

	it('sorts deterministically and slices the requested page', () => {
		const result = getPage(rows, {
			sortBy: 'marketCap',
			sortDesc: 'false',
			page: '2',
			pageSize: '2'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['ethena', 'uniswap'])
		expect(result.rows.map((item) => item.rowNumber)).toEqual([3, 4])
		expect(result.total).toBe(4)
		expect(result.page).toBe(2)
		expect(result.pageSize).toBe(2)
		expect(result.hasMore).toBe(false)
	})

	it('keeps missing numeric sort values last when sorting descending', () => {
		const rowsWithMissingValue = [...rows, row({ id: 'no-market-cap', name: 'No Market Cap', symbol: 'NONE' })]
		const result = getPage(rowsWithMissingValue, {
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap', 'ethena', 'aave', 'curve', 'no-market-cap'])
	})
})

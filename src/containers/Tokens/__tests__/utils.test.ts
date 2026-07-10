import { describe, expect, it } from 'vitest'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensSourceRow } from '../types'
import { buildTokensSortIndexes, getTokensPageFromRows, getTokensPageQuery } from '../utils'

function row(overrides: Partial<TokensSourceRow> & Pick<TokensSourceRow, 'id' | 'name' | 'symbol'>): TokensSourceRow {
	return {
		rank: null,
		logo: null,
		href: null,
		tokenRightsHref: null,
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
			pageSize: 50,
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

	it('formats prices with meaningful precision and USD values without compact suffixes', () => {
		const result = getPage(
			[
				row({ id: 'near-dollar', name: 'Near Dollar', symbol: 'NEAR', price: 0.9992, marketCap: 61_853.24 }),
				row({ id: 'small', name: 'Small', symbol: 'SMALL', price: 0.00001234, marketCap: 1000 })
			],
			{ sortBy: 'marketCap', pageSize: '50' }
		)

		expect(result.rows[0].display).toMatchObject({ price: '$0.9992', marketCap: '$61,853.24' })
		expect(result.rows[1].display).toMatchObject({ price: '$0.00001234', marketCap: '$1,000.00' })
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

	it('filters to the requested ids (case-insensitive) for the watchlist', () => {
		const result = getPage(rows, {
			ids: 'AAVE,Uniswap',
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap', 'aave'])
		expect(result.total).toBe(2)
	})

	it('combines the ids filter with search', () => {
		const result = getPage(rows, {
			ids: 'aave,uniswap',
			search: 'uni',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap'])
		expect(result.total).toBe(1)
	})

	it('returns nothing when an ids param is present but empty', () => {
		const result = getPage(rows, { ids: '', pageSize: '20' })

		expect(result.rows).toEqual([])
		expect(result.total).toBe(0)
	})
})

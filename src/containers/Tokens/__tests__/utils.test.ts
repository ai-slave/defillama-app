import { describe, expect, test } from 'vitest'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensSourceRow } from '../types'
import {
	buildTokensChartQueryString,
	buildTokensSortIndexes,
	getTokensPageFromRows,
	getTokensPageQuery,
	resolveTokenFilterValues
} from '../utils'

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
		isStablecoin: false,
		searchKey: `${overrides.name} ${overrides.symbol}`.toLowerCase(),
		chains: [],
		primaryChain: null,
		categories: [],
		...overrides
	}
}

const basePage = {
	schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
	snapshotVersion: null,
	unavailableSources: [],
	stats: {
		totalMarketCap: 0,
		marketCapWeightedChange24h: null,
		spotVolume24h: 0,
		perpsVolume24h: 0,
		openInterest24h: 0,
		unlock30dUsd: 0,
		upcomingUnlockUsd: 0
	},
	updatedAt: null,
	chainOptions: [],
	categoryOptions: []
}

function getPage(rows: Array<TokensSourceRow>, query: Record<string, string | Array<string>>) {
	const chains = new Set<string>()
	const categories = new Set<string>()
	for (const item of rows) {
		for (const chain of item.chains) chains.add(chain)
		for (const category of item.categories) categories.add(category)
	}
	return getTokensPageFromRows(rows, buildTokensSortIndexes(rows), query, {
		...basePage,
		chainOptions: [...chains].map((id) => ({ id, label: id })),
		categoryOptions: [...categories].map((id) => ({ id, label: id }))
	})
}

describe('token filter query values', () => {
	test('preserves canonical IDs and resolves include and exclude selections', () => {
		const allValues = ['ethereum', 'solana', 'bsc']
		expect(resolveTokenFilterValues(null, [], allValues)).toEqual(allValues)
		expect(resolveTokenFilterValues(['solana'], [], allValues)).toEqual(['solana'])
		expect(resolveTokenFilterValues(null, ['solana'], allValues)).toEqual(['ethereum', 'bsc'])
		expect(resolveTokenFilterValues(['None'], [], allValues)).toEqual([])
		expect(resolveTokenFilterValues(['Solana'], [], allValues)).toEqual([])
	})
})

describe('getTokensPageQuery', () => {
	test('normalizes invalid query params to defaults', () => {
		expect(
			getTokensPageQuery({
				page: '0',
				pageSize: 'bad',
				sortBy: 'bad',
				sortDesc: 'maybe',
				nativeOnly: 'yes',
				category: 'not-real',
				min_notAField: '5',
				search: '  ethena  '
			})
		).toEqual({
			page: 1,
			pageSize: 50,
			sortBy: 'marketCap',
			sortDesc: true,
			search: 'ethena',
			rankFrom: null,
			rankTo: null,
			numericFilters: [],
			chains: null,
			excludeChains: [],
			nativeOnly: false,
			categories: null,
			excludeCategories: []
		})
	})

	test('caps oversized page sizes and accepts supported sort params', () => {
		expect(
			getTokensPageQuery({
				page: '3',
				pageSize: '9999',
				sortBy: 'priceChange7d',
				sortDesc: 'false',
				chains: 'ethereum',
				nativeOnly: 'true',
				category: 'dexs'
			})
		).toEqual({
			page: 3,
			pageSize: 500,
			sortBy: 'priceChange7d',
			sortDesc: false,
			search: '',
			rankFrom: null,
			rankTo: null,
			numericFilters: [],
			chains: ['ethereum'],
			excludeChains: [],
			nativeOnly: true,
			categories: null,
			excludeCategories: []
		})
	})

	test('parses the rank range, swapping inverted bounds and dropping garbage', () => {
		expect(getTokensPageQuery({ rankFrom: '500', rankTo: '100' })).toMatchObject({ rankFrom: 100, rankTo: 500 })
		expect(getTokensPageQuery({ rankFrom: 'abc', rankTo: '-3' })).toMatchObject({ rankFrom: null, rankTo: null })
		expect(getTokensPageQuery({ rankFrom: '10.9' })).toMatchObject({ rankFrom: 10, rankTo: null })
	})
})

describe('getTokensPageFromRows', () => {
	const rows = [
		row({ id: 'ethena', name: 'Ethena', symbol: 'ENA', marketCap: 900 }),
		row({ id: 'uniswap', name: 'Uniswap', symbol: 'UNI', marketCap: 1200 }),
		row({ id: 'aave', name: 'Aave', symbol: 'AAVE', marketCap: 800 }),
		row({ id: 'curve', name: 'Curve', symbol: 'CRV', marketCap: 800 })
	]

	test('filters by rank range and sorts within it', () => {
		const rankedRows = [
			row({ id: 'first', name: 'First', symbol: 'F', rank: 1, priceChange7d: 1, marketCap: 1000 }),
			row({ id: 'second', name: 'Second', symbol: 'S', rank: 150, priceChange7d: 9, marketCap: 900 }),
			row({ id: 'third', name: 'Third', symbol: 'T', rank: 300, priceChange7d: 5, marketCap: 800 }),
			row({ id: 'unranked', name: 'Unranked', symbol: 'U', rank: null, priceChange7d: 99, marketCap: 700 })
		]
		const result = getPage(rankedRows, {
			rankFrom: '100',
			rankTo: '500',
			sortBy: 'priceChange7d',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['second', 'third'])
		expect(result.total).toBe(2)
		expect(result.rows.map((item) => item.rank)).toEqual([150, 300])
	})

	test('filters by search before sorting and pagination', () => {
		const result = getPage(rows, {
			search: 'uni',
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap'])
		expect(result.total).toBe(1)
		expect(result.hasMore).toBe(false)
	})

	test('formats prices with meaningful precision and other USD values compactly', () => {
		const result = getPage(
			[
				row({ id: 'near-dollar', name: 'Near Dollar', symbol: 'NEAR', price: 0.9992, marketCap: 61_853.24 }),
				row({ id: 'small', name: 'Small', symbol: 'SMALL', price: 0.00001234, marketCap: 1000 })
			],
			{ sortBy: 'marketCap', pageSize: '50' }
		)

		expect(result.rows[0]?.display).toMatchObject({ price: '$0.9992', marketCap: '$61.85K' })
		expect(result.rows[1]?.display).toMatchObject({ price: '$0.00001234', marketCap: '$1K' })
	})

	test('sorts deterministically and slices the requested page', () => {
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

	test('keeps missing numeric sort values last when sorting descending', () => {
		const rowsWithMissingValue = [...rows, row({ id: 'no-market-cap', name: 'No Market Cap', symbol: 'NONE' })]
		const result = getPage(rowsWithMissingValue, {
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap', 'ethena', 'aave', 'curve', 'no-market-cap'])
	})

	test('filters to the requested ids (case-insensitive) for the watchlist', () => {
		const result = getPage(rows, {
			ids: 'AAVE,Uniswap',
			sortBy: 'marketCap',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap', 'aave'])
		expect(result.total).toBe(2)
	})

	test('combines the ids filter with search', () => {
		const result = getPage(rows, {
			ids: 'aave,uniswap',
			search: 'uni',
			pageSize: '20'
		})

		expect(result.rows.map((item) => item.id)).toEqual(['uniswap'])
		expect(result.total).toBe(1)
	})

	test('returns nothing when an ids param is present but empty', () => {
		const result = getPage(rows, { ids: '', pageSize: '20' })

		expect(result.rows).toEqual([])
		expect(result.total).toBe(0)
	})

	test('applies numeric min/max filters and drops rows with missing values', () => {
		const rowsWithChange = [
			row({ id: 'up', name: 'Up', symbol: 'UP', marketCap: 900, priceChange7d: 25 }),
			row({ id: 'down', name: 'Down', symbol: 'DOWN', marketCap: 800, priceChange7d: -30 }),
			row({ id: 'flat', name: 'Flat', symbol: 'FLAT', marketCap: 700, priceChange7d: 1 }),
			row({ id: 'unknown', name: 'Unknown', symbol: 'NONE', marketCap: 600, priceChange7d: null })
		]

		const result = getPage(rowsWithChange, { min_priceChange7d: '-5', max_priceChange7d: '30', pageSize: '20' })
		expect(result.rows.map((item) => item.id)).toEqual(['up', 'flat'])
		expect(result.total).toBe(2)

		const swapped = getPage(rowsWithChange, { min_priceChange7d: '30', max_priceChange7d: '-5', pageSize: '20' })
		expect(swapped.rows.map((item) => item.id)).toEqual(['up', 'flat'])
	})

	test('uses OR within filter families and AND between chains and categories', () => {
		const filterRows = [
			row({
				id: 'ethereum-rwa',
				name: 'Ethereum RWA',
				symbol: 'ERWA',
				marketCap: 300,
				chains: ['ethereum'],
				categories: ['real-world-assets-rwa']
			}),
			row({
				id: 'ethereum-stable',
				name: 'Ethereum Stable',
				symbol: 'EST',
				marketCap: 200,
				chains: ['ethereum'],
				categories: ['stablecoins']
			}),
			row({
				id: 'solana-rwa',
				name: 'Solana RWA',
				symbol: 'SRWA',
				marketCap: 100,
				chains: ['solana'],
				categories: ['real-world-assets-rwa']
			})
		]

		const result = getPage(filterRows, {
			chains: 'ethereum',
			categories: ['stablecoins', 'real-world-assets-rwa'],
			pageSize: '20'
		})
		expect(result.rows.map((item) => item.id)).toEqual(['ethereum-rwa', 'ethereum-stable'])

		const excluded = getPage(filterRows, { excludeChains: 'solana', pageSize: '20' })
		expect(excluded.rows.map((item) => item.id)).toEqual(['ethereum-rwa', 'ethereum-stable'])

		const deselected = getPage(filterRows, { categories: 'None', pageSize: '20' })
		expect(deselected.total).toBe(0)
	})

	test('matches selected chains against primary chains only when requested', () => {
		const filterRows = [
			row({
				id: 'chainlink',
				name: 'Chainlink',
				symbol: 'LINK',
				chains: ['ethereum', 'robinhood'],
				primaryChain: 'ethereum'
			}),
			row({
				id: 'robinhood-native',
				name: 'Robinhood Native',
				symbol: 'RHN',
				chains: ['robinhood'],
				primaryChain: 'robinhood'
			}),
			row({
				id: 'unknown-primary',
				name: 'Unknown Primary',
				symbol: 'UNKNOWN',
				chains: ['robinhood']
			})
		]

		expect(getPage(filterRows, { chains: 'robinhood' }).rows.map((item) => item.id)).toEqual([
			'chainlink',
			'robinhood-native',
			'unknown-primary'
		])
		expect(getPage(filterRows, { chains: 'robinhood', nativeOnly: 'true' }).rows.map((item) => item.id)).toEqual([
			'robinhood-native'
		])
		expect(getPage(filterRows, { chains: 'ethereum', nativeOnly: 'true' }).rows.map((item) => item.id)).toEqual([
			'chainlink'
		])
		expect(getPage(filterRows, { nativeOnly: 'true' }).rows.map((item) => item.id)).toEqual([
			'chainlink',
			'robinhood-native',
			'unknown-primary'
		])
	})

	test('returns no rows for a present unknown-only category and keeps memberships internal', () => {
		const filterRows = [
			row({
				id: 'rwa-stable',
				name: 'RWA Stable',
				symbol: 'RWAS',
				chains: ['ethereum'],
				categories: ['real-world-assets-rwa', 'stablecoins']
			})
		]
		const unknown = getPage(filterRows, { categories: 'not-a-category', pageSize: '20' })
		expect(unknown.total).toBe(0)

		const matched = getPage(filterRows, { categories: 'stablecoins', pageSize: '20' })
		expect(matched.rows[0]).not.toHaveProperty('chains')
		expect(matched.rows[0]).not.toHaveProperty('primaryChain')
		expect(matched.rows[0]).not.toHaveProperty('categories')
	})
})

describe('buildTokensChartQueryString', () => {
	test('keeps only filters so map and movers share one dataset across sort and paging', () => {
		expect(
			buildTokensChartQueryString({
				page: '3',
				pageSize: '100',
				sortBy: 'fdv',
				sortDesc: 'false',
				view: 'map',
				chartTop: '300',
				search: ' Eth ',
				categories: ['governance', 'dex'],
				excludeChains: 'solana',
				nativeOnly: 'true',
				rankFrom: '10',
				min_marketCap: '1000000'
			})
		).toBe(
			'?search=Eth&rankFrom=10&excludeChains=solana&nativeOnly=true&categories=governance&categories=dex&min_marketCap=1000000'
		)
		expect(buildTokensChartQueryString({ page: '2', view: 'movers' })).toBe('')
	})
})

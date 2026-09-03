import { describe, expect, it, vi } from 'vitest'
import type { TokensTableRow } from '../types'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION } from '../types'

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson }))

const { prepareTokensCsv } = await import('../csv')

function row(overrides: Partial<TokensTableRow>): TokensTableRow {
	return {
		id: 'bitcoin',
		rank: 1,
		rowNumber: 1,
		name: 'Bitcoin',
		symbol: 'BTC',
		logo: null,
		href: null,
		tokenRightsHref: null,
		price: 100,
		priceChange1h: null,
		priceChange24h: 1.5,
		priceChange7d: null,
		priceChange30d: null,
		marketCap: 1000,
		fdv: 2000,
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
		display: {} as TokensTableRow['display'],
		...overrides
	}
}

function pageResponse(rows: TokensTableRow[], hasMore: boolean) {
	return {
		schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
		rows,
		hasMore
	}
}

describe('prepareTokensCsv', () => {
	it('fetches pages until hasMore is false and respects hidden columns', async () => {
		fetchJson.mockReset()
		fetchJson
			.mockResolvedValueOnce(pageResponse([row({ rowNumber: 1 })], true))
			.mockResolvedValueOnce(pageResponse([row({ rowNumber: 2, name: 'Ethereum', symbol: 'ETH' })], false))

		const { filename, rows } = await prepareTokensCsv({
			query: {},
			sorting: [{ id: 'marketCap', desc: true }],
			hiddenColumnIds: new Set(['fdv'])
		})

		expect(filename).toBe('tokens.csv')
		expect(fetchJson).toHaveBeenCalledTimes(2)
		expect(fetchJson.mock.calls[0][0]).toBe('/api/public/tokens?pageSize=500')
		expect(fetchJson.mock.calls[1][0]).toBe('/api/public/tokens?page=2&pageSize=500')
		expect(rows[0]).not.toContain('FDV')
		expect(rows[0]).toContain('MCap')
		expect(rows).toHaveLength(3)
		expect(rows[1][1]).toBe('Bitcoin (BTC)')
		expect(rows[2][1]).toBe('Ethereum (ETH)')
	})

	it('carries table query params into the export requests', async () => {
		fetchJson.mockReset()
		fetchJson.mockResolvedValueOnce(pageResponse([], false))

		await prepareTokensCsv({
			query: {
				search: 'uni',
				rankFrom: '100',
				rankTo: '500',
				chains: ['solana', 'ethereum'],
				excludeCategories: 'meme-token'
			},
			sorting: [{ id: 'priceChange7d', desc: false }],
			hiddenColumnIds: new Set()
		})

		const requestUrl = new URL(fetchJson.mock.calls[0][0], 'https://defillama.com')
		expect(requestUrl.pathname).toBe('/api/public/tokens')
		expect(requestUrl.searchParams.getAll('chains')).toEqual(['solana', 'ethereum'])
		expect(Object.fromEntries(requestUrl.searchParams)).toMatchObject({
			pageSize: '500',
			sortBy: 'priceChange7d',
			sortDesc: 'false',
			search: 'uni',
			rankFrom: '100',
			rankTo: '500',
			excludeCategories: 'meme-token'
		})
	})

	it('throws instead of silently returning a partial csv', async () => {
		fetchJson.mockReset()
		fetchJson.mockResolvedValueOnce({ schemaVersion: -1, rows: [], hasMore: false })

		await expect(
			prepareTokensCsv({ query: {}, sorting: [{ id: 'marketCap', desc: true }], hiddenColumnIds: new Set() })
		).rejects.toThrow('unexpected response schema')
	})
})

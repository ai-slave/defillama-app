import { describe, expect, it } from 'vitest'
import type { TokenExchangeListing } from '~/containers/Markets/api.types'
import { buildTokenFinderRows } from '../ExchangeTokenFinder'
import type { ExchangeDirectoryModel } from '../models'

const directory = {
	rows: [
		{ slug: 'both', name: 'Both', totalVolume24h: 100, regional: null },
		{ slug: 'btc-only', name: 'BTC only', totalVolume24h: 200, regional: null }
	],
	summary: {},
	updatedAt: ''
} as ExchangeDirectoryModel

function tokenListing(
	coingeckoId: string,
	symbol: string,
	listings: Array<{ slug: string; segment: 'spot' | 'linear_perp' }>
): TokenExchangeListing {
	return {
		coingecko_id: coingeckoId,
		name: symbol.toUpperCase(),
		symbol,
		venues: listings.map((listing) => ({
			slug: listing.slug,
			display_name: listing.slug,
			type: 'cex',
			segments: [listing.segment]
		}))
	}
}

describe('exchange token finder', () => {
	const tokens = [
		tokenListing('bitcoin', 'btc', [
			{ slug: 'both', segment: 'spot' },
			{ slug: 'btc-only', segment: 'spot' }
		]),
		tokenListing('ethereum', 'eth', [{ slug: 'both', segment: 'linear_perp' }])
	]

	it('distinguishes all-token from any-token matching', () => {
		const common = { selectedTokens: ['bitcoin', 'ethereum'], tokens, directory, country: null, catalog: null }
		const allRows = buildTokenFinderRows({ ...common, mode: 'all' })
		expect(allRows.map((row) => row.slug)).toEqual(['both'])
		const firstRow = allRows[0]
		if (!firstRow) throw new Error('Expected token finder row')
		expect(firstRow.listings).toEqual([
			{ token: 'btc', segments: ['spot'] },
			{ token: 'eth', segments: ['linear_perp'] }
		])
		expect(buildTokenFinderRows({ ...common, mode: 'any' }).map((row) => row.slug)).toEqual(['btc-only', 'both'])
	})
})

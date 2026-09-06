import { describe, expect, test } from 'vitest'
import type { MarketSegmentSummary, TokenMarketsListResponse } from '~/containers/Markets/api.types'
import type { TokensTableRow } from '~/containers/Tokens/types'
import { mergeMarketsSummary } from '../marketsMerge'

function segment(overrides: Partial<MarketSegmentSummary>): MarketSegmentSummary {
	return {
		exchange_count: 1,
		funding_rate_8h: null,
		leverage_max: null,
		leverage_min: null,
		market_count: 1,
		oi_prev_usd: null,
		oi_usd: null,
		price: null,
		price_change_24h: null,
		volume_24h: 0,
		volume_prev_24h: null,
		...overrides
	}
}

function row(overrides: Partial<TokensTableRow> & Pick<TokensTableRow, 'id' | 'symbol'>): TokensTableRow {
	return {
		rowNumber: 1,
		rank: 1,
		name: overrides.symbol,
		logo: '',
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
		display: {} as TokensTableRow['display'],
		...overrides
	}
}

function marketsList(tokens: TokenMarketsListResponse['tokens']): TokenMarketsListResponse {
	return { last_updated: '', tokens }
}

describe('mergeMarketsSummary', () => {
	test('returns base rows unchanged when the markets list is unavailable', () => {
		const rows = [row({ id: 'bitcoin', symbol: 'BTC', marketCap: 1_000_000 })]
		expect(mergeMarketsSummary(rows, undefined)).toBe(rows)
	})

	test('fills the highest-market-cap coin of a shared symbol and leaves duplicates empty', () => {
		const rows = [
			row({ id: 'bitcoin', symbol: 'BTC', marketCap: 1_000_000, rank: 1 }),
			row({ id: 'wrapped-bitcoin', symbol: 'BTC', marketCap: 10_000, rank: 20 })
		]
		const result = mergeMarketsSummary(
			rows,
			marketsList([
				{
					symbol: 'BTC',
					exchange_count: 42,
					market_count: 99,
					tags: [],
					total_oi_usd: null,
					total_volume_24h: 0,
					segments: {
						spot: segment({ volume_24h: 500 }),
						linear_perp: segment({ volume_24h: 300, oi_usd: 750 })
					}
				}
			])
		)

		const bitcoin = result.find((r) => r.id === 'bitcoin')!
		const wrapped = result.find((r) => r.id === 'wrapped-bitcoin')!
		expect(bitcoin).toMatchObject({ spotVolume24h: 500, perpsVolume24h: 300, openInterest24h: 750 })
		expect(bitcoin.display).toMatchObject({ spotVolume24h: '$500', perpsVolume24h: '$300', openInterest24h: '$750' })
		expect(wrapped).toMatchObject({ spotVolume24h: null, perpsVolume24h: null, openInterest24h: null })
	})

	test('does not overwrite volume values the server already computed', () => {
		const serverRow = row({
			id: 'aave',
			symbol: 'AAVE',
			marketCap: 5000,
			spotVolume24h: 123,
			display: { spotVolume24h: '$123' } as TokensTableRow['display']
		})
		const result = mergeMarketsSummary(
			[serverRow],
			marketsList([
				{
					symbol: 'AAVE',
					exchange_count: 1,
					market_count: 1,
					tags: [],
					total_oi_usd: null,
					total_volume_24h: 0,
					segments: { spot: segment({ volume_24h: 999 }) }
				}
			])
		)

		// Existing spot value is preserved; the row is returned untouched (no perps/OI to fill either).
		expect(result[0]).toBe(serverRow)
		expect(result[0]?.spotVolume24h).toBe(123)
	})

	test('leaves a canonical row empty when the markets list has no entry for its symbol', () => {
		const rows = [row({ id: 'obscure', symbol: 'ZZZ', marketCap: 1 })]
		const result = mergeMarketsSummary(rows, marketsList([]))
		expect(result[0]).toBe(rows[0])
		expect(result[0]?.spotVolume24h).toBeNull()
	})
})

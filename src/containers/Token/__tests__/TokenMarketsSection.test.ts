import { describe, expect, it } from 'vitest'
import { resolvePairColumns, resolvePairColumnVisibility } from '~/containers/Exchanges/PairTable'
import type { MarketPair } from '~/containers/Markets/api.types'
import {
	rankRowsBybitFirst,
	TOKEN_PAGE_COLUMN_ORDER,
	TOKEN_PAGE_VISIBLE_COLUMNS,
	toPairTableRow
} from '../TokenMarketsSection'

const DEPTH_BANDS = [0.01, 0.02]

function marketPair(slug: string, displayName: string, volume24h: number): MarketPair {
	return {
		slug,
		display_name: displayName,
		type: 'cex',
		market_type: 'spot',
		contract_type: '',
		base: 'btc',
		quote: 'usdt',
		base_coingecko_id: 'bitcoin',
		quote_coingecko_id: 'tether',
		settle_asset: '',
		pair_id: 'BTCUSDT',
		market_id: `${slug}:cex:spot:btcusdt`,
		pair_url: `https://example.com/${slug}/btcusdt`,
		symbol: 'btc/usdt',
		price: 62_900,
		mark_price: null,
		index_price: null,
		price_change_24h: -0.0156,
		volume_24h: volume24h,
		volume_prev_24h: volume24h * 0.9,
		volume_change_24h: 1 / 9,
		oi: null,
		oi_usd: null,
		oi_prev_usd: null,
		oi_change_24h: null,
		funding_rate_8h: null,
		funding_period_h: null,
		next_funding_ts: null,
		max_leverage: null,
		maker_fee: null,
		taker_fee: null,
		amount_precision: null,
		price_precision: null,
		contract_size: 1,
		expiry_ts: null,
		listed_ts: null,
		min_order_cost: null,
		best_bid: 62_899,
		best_ask: 62_901,
		depth_bid_usd: [100, 200],
		depth_ask_usd: [300, 400],
		depth_bid_max_dist: 0.03,
		depth_ask_max_dist: 0.04,
		nvol: {
			reported: volume24h,
			normalized: volume24h * 0.8,
			active_liquidity: 1_000_000,
			active_liquidity_measured: 1_000_000,
			band: 0.05,
			daily_vol: 0.03,
			coverage: 0.03,
			status: 'covered',
			category: 'normal',
			flag: null
		},
		freshness: { volume: '2026-07-17T09:17:00.000Z', oi: null, funding: null, depth: null }
	}
}

describe('token markets rows', () => {
	it.each([
		[
			'spot',
			[
				'venue',
				'pair',
				'price',
				'priceChange24h',
				'depth2Usd',
				'volume24h',
				'volumeChange24h',
				'normalizedVolume',
				'makerFee',
				'takerFee'
			]
		],
		[
			'linear_perp',
			[
				'venue',
				'pair',
				'price',
				'priceChange24h',
				'depth2Usd',
				'volume24h',
				'volumeChange24h',
				'normalizedVolume',
				'openInterestUsd',
				'openInterestChange24h',
				'fundingRate8h',
				'makerFee',
				'takerFee'
			]
		],
		[
			'inverse_perp',
			[
				'venue',
				'pair',
				'price',
				'priceChange24h',
				'depth2Usd',
				'volume24h',
				'volumeChange24h',
				'openInterestUsd',
				'openInterestChange24h',
				'fundingRate8h',
				'makerFee',
				'takerFee'
			]
		]
	] as const)('resolves the %s table to the requested visible column order', (segment, expected) => {
		const columns = resolvePairColumns({
			segment,
			capabilities: {
				openInterest: segment !== 'spot',
				funding: segment !== 'spot',
				depth: true
			},
			showVenue: true,
			omitColumns: ['token'],
			columnOrder: TOKEN_PAGE_COLUMN_ORDER
		})
		const visibility = resolvePairColumnVisibility(columns, TOKEN_PAGE_VISIBLE_COLUMNS[segment])
		const visibleColumnIds = columns
			.filter((column) => !column.meta?.hidden && visibility[column.id as string] !== false)
			.map((column) => column.id)

		expect(visibleColumnIds).toEqual(expected)
		expect(visibleColumnIds).not.toContain('maxLeverage')
	})

	it('maps the curated exchange name and derives its canonical profile route', () => {
		expect(toPairTableRow(marketPair('binance-us', 'Binance.US', 100), DEPTH_BANDS, 'spot')).toMatchObject({
			baseGeckoId: 'bitcoin',
			quoteGeckoId: 'tether',
			venue: 'Binance.US',
			venueSlug: 'binance-us',
			venueUrl: '/exchange/binance-us'
		})
	})

	it('maps depth and normalized volume from the token response', () => {
		expect(toPairTableRow(marketPair('binance', 'Binance', 1_000), DEPTH_BANDS, 'spot')).toMatchObject({
			depthBid2Usd: 200,
			depthAsk2Usd: 400,
			depthBidMaxDistance: 0.03,
			depthAskMaxDistance: 0.04,
			normalizedVolume: {
				reported: 1_000,
				normalized: 800,
				discountFraction: 0.2,
				status: 'covered'
			}
		})
	})

	it('keeps normalized volume unavailable for inverse perps', () => {
		expect(
			toPairTableRow(marketPair('deribit', 'Deribit', 1_000), DEPTH_BANDS, 'inverse_perp').normalizedVolume
		).toBeNull()
	})

	it('prioritizes the highest-volume Bybit pair before other venues', () => {
		const binance = marketPair('binance', 'Binance', 300)
		const smallerBybit = marketPair('bybit', 'Bybit', 100)
		const largerBybit = marketPair('bybit', 'Bybit', 200)

		expect(rankRowsBybitFirst([smallerBybit, binance, largerBybit])).toEqual([largerBybit, binance, smallerBybit])
	})

	it('keeps normal volume ordering when Bybit is absent', () => {
		const smaller = marketPair('coinbase', 'Coinbase', 100)
		const larger = marketPair('binance', 'Binance', 300)

		expect(rankRowsBybitFirst([smaller, larger])).toEqual([larger, smaller])
	})
})

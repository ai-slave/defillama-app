import { describe, expect, test } from 'vitest'
import type { MarketPair, TokenMarketsResponse } from '~/containers/Markets/api.types'
import {
	getAvailableCategoriesByVenue,
	getCategoryRows,
	rankRowsBybitFirst,
	resolveTokenMarketsSelection,
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
	test('maps the curated exchange name and derives its canonical profile route', () => {
		expect(toPairTableRow(marketPair('binance-us', 'Binance.US', 100), DEPTH_BANDS, 'spot')).toMatchObject({
			baseGeckoId: 'bitcoin',
			quoteGeckoId: 'tether',
			venue: 'Binance.US',
			venueSlug: 'binance-us',
			venueUrl: '/exchange/binance-us'
		})
	})

	test('maps depth and normalized volume from the token response', () => {
		expect(toPairTableRow(marketPair('binance', 'Binance', 1000), DEPTH_BANDS, 'spot')).toMatchObject({
			depthBid2Usd: 200,
			depthAsk2Usd: 400,
			depthBidMaxDistance: 0.03,
			depthAskMaxDistance: 0.04,
			normalizedVolume: {
				reported: 1000,
				normalized: 800,
				discountFraction: 0.2,
				status: 'covered'
			}
		})
	})

	test('keeps normalized volume unavailable for inverse perps', () => {
		expect(
			toPairTableRow(marketPair('deribit', 'Deribit', 1000), DEPTH_BANDS, 'inverse_perp').normalizedVolume
		).toBeNull()
	})

	test('prioritizes the highest-volume Bybit pair before other venues', () => {
		const binance = marketPair('binance', 'Binance', 300)
		const smallerBybit = marketPair('bybit', 'Bybit', 100)
		const largerBybit = marketPair('bybit', 'Bybit', 200)

		expect(rankRowsBybitFirst([smallerBybit, binance, largerBybit])).toEqual([largerBybit, binance, smallerBybit])
	})

	test('keeps normal volume ordering when Bybit is absent', () => {
		const smaller = marketPair('coinbase', 'Coinbase', 100)
		const larger = marketPair('binance', 'Binance', 300)

		expect(rankRowsBybitFirst([smaller, larger])).toEqual([larger, smaller])
	})
})

const totals = {
	spot: { pair_count: 2, total_volume_24h: 110, total_oi_usd: null },
	linear_perp: { pair_count: 1, total_volume_24h: 100, total_oi_usd: 100 },
	inverse_perp: { pair_count: 1, total_volume_24h: 50, total_oi_usd: 100 }
}
const NO_PAIRS = { spot: [], linear_perp: [], inverse_perp: [] }
const markets: TokenMarketsResponse = {
	symbol: 'BTC',
	last_updated: '',
	depth_bands: DEPTH_BANDS,
	exchange_count: 4,
	market_count: 6,
	segments: {},
	tags: [],
	total_oi_usd: 200,
	total_volume_24h: 370,
	cex: {
		spot: [marketPair('binance', 'Binance', 100), marketPair('bybit', 'Bybit', 10)],
		linear_perp: [marketPair('bybit', 'Bybit', 100)],
		inverse_perp: [marketPair('bybit', 'Bybit', 50)]
	},
	dex: {
		spot: [
			{ ...marketPair('uniswap', 'Uniswap', 20), type: 'dex' },
			{ ...marketPair('curve', 'Curve', 90), type: 'dex' }
		],
		linear_perp: [],
		inverse_perp: []
	},
	totals: { cex: totals, dex: totals }
}

function select(
	data: TokenMarketsResponse,
	venue: 'all' | 'cex' | 'dex',
	category: 'spot' | 'linear_perp' | 'inverse_perp'
) {
	const selection = resolveTokenMarketsSelection(getAvailableCategoriesByVenue(data), venue, category)
	return {
		venues: selection.visibleVenueTabs.map((tab) => tab.value),
		venue: selection.selectedVenueTab,
		categories: selection.visibleCategoryTabs.map((tab) => tab.value),
		category: selection.selectedCategoryTab,
		sorting: selection.sorting
	}
}

describe('token markets venue and category tabs', () => {
	test('All and CEX lead with the top Bybit pair unsorted; DEX sorts by volume', () => {
		const names = (venue: 'all' | 'cex' | 'dex') =>
			getCategoryRows(markets, venue, 'spot').map((row) => row.display_name)

		expect(names('all')).toEqual(['Bybit', 'Binance', 'Curve', 'Uniswap'])
		expect(names('cex')).toEqual(['Bybit', 'Binance'])
		expect(select(markets, 'all', 'spot').sorting).toEqual([])
		expect(select(markets, 'dex', 'spot').sorting).toEqual([{ id: 'volume24h', desc: true }])
	})

	test('shows only categories the venue has, and restores the preferred one when it has rows again', () => {
		expect(select(markets, 'dex', 'inverse_perp')).toMatchObject({ categories: ['spot'], category: 'spot' })
		expect(select(markets, 'all', 'inverse_perp')).toMatchObject({
			categories: ['spot', 'linear_perp', 'inverse_perp'],
			category: 'inverse_perp'
		})
		expect(select({ ...markets, cex: { ...markets.cex, inverse_perp: [] } }, 'all', 'inverse_perp').category).toBe(
			'spot'
		)
	})

	test('falls back to the first venue with rows and recovers the requested venue after an empty refresh', () => {
		expect(select({ ...markets, dex: NO_PAIRS }, 'dex', 'spot')).toMatchObject({ venues: ['all', 'cex'], venue: 'all' })
		expect(select({ ...markets, cex: NO_PAIRS, dex: NO_PAIRS }, 'dex', 'spot').venues).toEqual([])
		expect(select(markets, 'dex', 'spot')).toMatchObject({ venues: ['all', 'cex', 'dex'], venue: 'dex' })
	})
})

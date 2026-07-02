import { describe, expect, it } from 'vitest'
import type { ExchangeMetadataListEntry } from '../api.types'
import { filterMicaRows, getKycRequirementIndicators, rankMicaRows, selectActivePromotion } from '../MicaFinder'

function row(over: Partial<ExchangeMetadataListEntry>): ExchangeMetadataListEntry {
	return {
		available_regions: [],
		clean_reserves_usd: null,
		defillama_slug: null,
		depth_summary: {
			isPartialCoverage: false,
			perp_ask_depth_2pct_usd: 0,
			perp_bid_depth_2pct_usd: 0,
			spot_ask_depth_2pct_usd: 0,
			spot_bid_depth_2pct_usd: 0
		},
		display_name: 'X',
		eu_status: null,
		exchange: 'x',
		fee_token: null,
		inflows_24h_usd: null,
		kyc_required: null,
		kyc_short: null,
		kyc_summary: null,
		last_verified: null,
		market_count: null,
		mica_licensed: false,
		mica_member_state: null,
		mica_regulator: null,
		mica_status: null,
		native_token: null,
		oi_usd: null,
		own_eu_orderbook: null,
		own_token_pct: null,
		perp_fee: { maker: null, taker: null },
		products: [],
		promotions: [],
		ref_link: null,
		reserves_source_url: null,
		reserves_usd: null,
		restricted_regions: [],
		secondary: false,
		spot_fee: { maker: null, taker: null },
		volume_24h_usd: null,
		website: null,
		...over
	}
}

const ROWS: ExchangeMetadataListEntry[] = [
	row({
		exchange: 'kraken',
		mica_licensed: true,
		eu_status: 'available',
		products: ['spot', 'margin', 'perp', 'futures']
	}),
	row({ exchange: 'bitstamp', mica_licensed: true, eu_status: 'available', products: ['spot'] }),
	row({ exchange: 'gemini', mica_licensed: true, eu_status: 'unavailable', products: ['spot', 'perp'] }),
	row({ exchange: 'binance', mica_licensed: false, eu_status: 'available', products: ['spot', 'perp', 'options'] })
]

describe('filterMicaRows', () => {
	it('keeps only MiCA-licensed venues that are usable in the EU', () => {
		const out = filterMicaRows(ROWS, { products: [] })
		expect(out.map((r) => r.exchange)).toEqual(['kraken', 'bitstamp'])
	})

	it('AND-matches every selected product against the segment list', () => {
		// futures ⇒ only kraken among the usable MiCA rows offers it
		const out = filterMicaRows(ROWS, { products: ['spot', 'futures'] })
		expect(out.map((r) => r.exchange)).toEqual(['kraken'])
	})

	it('matches a single selected product across all MiCA venues', () => {
		const out = filterMicaRows(ROWS, { products: ['perp'] })
		expect(out.map((r) => r.exchange)).toEqual(['kraken'])
	})
})

describe('rankMicaRows', () => {
	it('keeps priority venues first, then ranks the rest by liquidity', () => {
		const rows = [
			row({
				display_name: 'CheapSpot',
				exchange: 'cheapspot',
				secondary: false,
				products: ['spot'],
				depth_summary: {
					isPartialCoverage: false,
					perp_ask_depth_2pct_usd: 0,
					perp_bid_depth_2pct_usd: 0,
					spot_ask_depth_2pct_usd: 150,
					spot_bid_depth_2pct_usd: 150
				},
				spot_fee: { maker: 0, taker: 0.0005 },
				volume_24h_usd: 100_000
			}),
			row({
				display_name: 'Coinbase',
				exchange: 'coinbase',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'OKX',
				exchange: 'okx',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'Crypto.com Exchange',
				exchange: 'cryptocom',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'Bybit',
				exchange: 'bybit',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'Bitstamp',
				exchange: 'bitstamp',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'Gate',
				exchange: 'gate',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'Kraken',
				exchange: 'kraken',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: 1
			}),
			row({
				display_name: 'PerpBroker',
				exchange: 'perpbroker',
				secondary: true,
				products: ['spot', 'perp'],
				depth_summary: {
					isPartialCoverage: false,
					perp_ask_depth_2pct_usd: 75,
					perp_bid_depth_2pct_usd: 75,
					spot_ask_depth_2pct_usd: 25,
					spot_bid_depth_2pct_usd: 25
				},
				spot_fee: { maker: 0, taker: 0.001 },
				volume_24h_usd: 100
			}),
			row({
				display_name: 'PerpMajor',
				exchange: 'perpmajor',
				secondary: false,
				products: ['spot', 'perp'],
				depth_summary: {
					isPartialCoverage: false,
					perp_ask_depth_2pct_usd: 50,
					perp_bid_depth_2pct_usd: 50,
					spot_ask_depth_2pct_usd: 25,
					spot_bid_depth_2pct_usd: 25
				},
				spot_fee: { maker: 0, taker: 0.002 },
				volume_24h_usd: 50
			}),
			row({
				display_name: 'ExpensiveSpot',
				exchange: 'expensivespot',
				secondary: false,
				products: ['spot'],
				spot_fee: { maker: 0, taker: 0.01 },
				volume_24h_usd: null
			})
		]
		expect(rankMicaRows(rows).map((r) => r.display_name)).toEqual([
			'Bybit',
			'Coinbase',
			'Crypto.com Exchange',
			'Gate',
			'OKX',
			'Kraken',
			'Bitstamp',
			'CheapSpot',
			'PerpBroker',
			'PerpMajor',
			'ExpensiveSpot'
		])
	})
})

describe('getKycRequirementIndicators', () => {
	it('uses kyc_short for compact ID, selfie, and proof-of-address indicators', () => {
		const indicators = getKycRequirementIndicators('ID + selfie + PoA')
		expect(indicators.map((indicator) => indicator.key)).toEqual(['id', 'selfie', 'poa'])
	})

	it('supports all compact KYC requirement tokens', () => {
		const indicators = getKycRequirementIndicators('ID + selfie + PoA + source-of-income + MiFID quiz')
		expect(indicators.map((indicator) => indicator.key)).toEqual(['id', 'selfie', 'poa', 'profile', 'quiz'])
	})
})

describe('selectActivePromotion', () => {
	it('picks the highest-priority active promotion', () => {
		const promo = selectActivePromotion(
			row({
				promotions: [
					{
						title: 'Future',
						label: 'Future promo',
						type: 'other',
						starts_at: '2026-07-01',
						priority: 100,
						source: { url: 'https://example.com' }
					},
					{
						title: 'Active low',
						label: 'Low promo',
						type: 'other',
						starts_at: '2026-06-01',
						priority: 1,
						source: { url: 'https://example.com' }
					},
					{
						title: 'Active high',
						label: 'High promo',
						type: 'cashback',
						ends_at: '2026-06-30',
						priority: 10,
						source: { url: 'https://example.com' }
					}
				]
			}),
			'2026-06-30'
		)

		expect(promo?.label).toBe('High promo')
	})

	it('drops expired promotions', () => {
		const promo = selectActivePromotion(
			row({
				promotions: [
					{
						title: 'Expired',
						label: 'Expired promo',
						type: 'deposit_bonus',
						ends_at: '2026-06-29',
						source: { url: 'https://example.com' }
					}
				]
			}),
			'2026-06-30'
		)

		expect(promo).toBeNull()
	})
})

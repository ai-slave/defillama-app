import type {
	MasterFreshness,
	MasterLiquidityBySegment,
	MasterVenueCore,
	MasterDirectoryTotals,
	MasterDirectoryVenue,
	MasterDirectoryResponse,
	MasterExecutionQualityResponse,
	MasterExchangePair,
	MasterExchangeIndexResponse,
	MasterExchangeMetadataResponse,
	MasterQualityRanksResponse,
	MasterRankMethodologyResponse
} from '../master.types'

const FRESHNESS: MasterFreshness = {
	volume: '2026-07-14T12:00:00Z',
	oi: '2026-07-14T12:00:00Z',
	funding: '2026-07-14T12:00:00Z',
	depth: '2026-07-14T12:00:00Z'
}

const OWN = { mode: 'own' } as const

export function liquidity(patch: Partial<MasterLiquidityBySegment> = {}): MasterLiquidityBySegment {
	return { spot: OWN, linear_perp: OWN, inverse_perp: null, ...patch }
}

export function venueCore(slug: string, patch: Partial<MasterVenueCore> = {}): MasterVenueCore {
	return {
		slug,
		display_name: 'Venue',
		type: 'cex',
		directory_visibility: 'listed',
		profile_mode: 'markets',
		scope: { kind: 'global' },
		parent_entity: null,
		related_entities: [],
		liquidity: liquidity(),
		links: {
			profile: `/exchange/${slug}`,
			website: { url: 'https://example.com', kind: 'official' },
			defillama: { slug: 'venue-cex', type: 'cex', url: '/cex/venue-cex' }
		},
		...patch
	}
}

export function totals(patch: Partial<MasterDirectoryTotals> = {}): MasterDirectoryTotals {
	return {
		venues: 1,
		tracked: 1,
		spot_volume_24h: 500,
		linear_perp_volume_24h: 600,
		inverse_perp_volume_24h: 100,
		total_trading_volume_24h: 1200,
		reserves_usd: 900,
		...patch
	}
}

export function directoryResponse(venues: Array<MasterDirectoryVenue>): MasterDirectoryResponse {
	return {
		venues,
		depth_bands: [0.02],
		totals: {
			...totals({ venues: venues.length, tracked: venues.filter((venue) => venue.tracked).length }),
			cex: totals(),
			dex: totals({
				venues: 0,
				tracked: 0,
				spot_volume_24h: null,
				linear_perp_volume_24h: null,
				inverse_perp_volume_24h: null,
				total_trading_volume_24h: null,
				reserves_usd: null
			})
		},
		freshness: FRESHNESS,
		last_updated: '2026-07-14T00:00:00Z'
	}
}

export function executionResponse(): MasterExecutionQualityResponse {
	const measurements = {
		cost_to_trade_bps: 4,
		effective_spread_bps: 2,
		quoted_spread_bps: 3,
		realized_slippage_bps_10k: 1,
		realized_slippage_bps_100k: 2,
		realized_slippage_bps_1m: 3,
		predicted_slippage_bps_10k: 1.5,
		predicted_slippage_bps_100k: 2.5,
		predicted_slippage_bps_1m: 3.5,
		slip_gap_bps_10k: -0.5,
		slip_gap_bps_100k: -0.5,
		markout_bps_1s: 0.1,
		markout_bps_15s: 0.2,
		markout_bps_1m: 0.3,
		markout_bps_5m: 0.4,
		taker_fee_bps: 2
	}
	return {
		basket: ['BTC'],
		unit: 'bps',
		unit_note: 'Basis points of trade notional.',
		venues: {
			venue: {
				...measurements,
				assets: ['BTC'],
				pair_count: 1,
				hours_covered: 24,
				n_trades: 10,
				pairs: {
					BTC: {
						...measurements,
						asset: 'BTC',
						symbol: 'BTC/USDT',
						hours_covered: 24,
						n_trades: 10
					}
				}
			}
		}
	}
}

export function pair(patch: Partial<MasterExchangePair> = {}): MasterExchangePair {
	return {
		market_type: 'perpetual',
		contract_type: 'linear',
		base: 'btc',
		quote: 'usdt',
		base_coingecko_id: 'bitcoin',
		quote_coingecko_id: 'tether',
		pair_id: 'BTCUSDT',
		market_id: 'venue:cex:perpetual:btcusdt',
		pair_url: 'https://example.com/btc-usdt',
		symbol: 'btc/usdt',
		price: 60_000,
		mark_price: 60_300,
		index_price: 60_000,
		price_change_24h: 0.02,
		volume_24h: 1000,
		volume_prev_24h: 800,
		oi: 2,
		oi_usd: 120_000,
		oi_prev_usd: 100_000,
		funding_rate_8h: 0.0001,
		contract_size: 1,
		settle_asset: 'usdt',
		funding_period_h: 8,
		next_funding_ts: 1_721_000_000,
		expiry_ts: null,
		listed_ts: 1_700_000_000,
		max_leverage: 50,
		taker_fee: 0.0005,
		maker_fee: 0.0002,
		price_precision: 0.1,
		amount_precision: 0.001,
		min_order_cost: 5,
		best_bid: 59_990,
		best_ask: 60_010,
		depth_bid_usd: [10, 20],
		depth_ask_usd: [12, 24],
		depth_bid_max_dist: 0.03,
		depth_ask_max_dist: 0.04,
		nvol: {
			reported: 1000,
			normalized: 700,
			active_liquidity: 350,
			active_liquidity_measured: 350,
			band: 0.02,
			daily_vol: 0.03,
			coverage: 0.04,
			status: 'covered',
			category: 'fully_supported',
			flag: null
		},
		volume_change_24h: 0.25,
		oi_change_24h: 0.2,
		freshness: FRESHNESS,
		...patch
	}
}

export function indexResponse(): MasterExchangeIndexResponse {
	return {
		slug: 'venue',
		type: 'cex',
		liquidity: liquidity({ spot: null, linear_perp: OWN, inverse_perp: OWN }),
		segments: {
			linear_perp: {
				markets: 1,
				coins: 1,
				volume_24h: null,
				volume_prev_24h: 800,
				oi_usd: 120_000,
				oi_prev_usd: 100_000,
				freshness: FRESHNESS,
				pairs: [pair()]
			},
			inverse_perp: {
				markets: 1,
				coins: 1,
				volume_24h: 200,
				volume_prev_24h: 100,
				oi_usd: null,
				oi_prev_usd: null,
				freshness: FRESHNESS,
				doublecount: { oi: 'Reported open interest counts both sides (~2× a one-sided figure)' },
				pairs: [pair({ contract_type: 'inverse', nvol: null })]
			}
		},
		capabilities: {
			linear_perp: { oi: true, funding: true, depth: true },
			inverse_perp: { oi: false, funding: false, depth: true }
		},
		freshness: FRESHNESS,
		depth_bands: [0.005, 0.02],
		last_updated: '2026-07-14T00:00:00Z'
	}
}

export function metadataResponse(): MasterExchangeMetadataResponse {
	return {
		...venueCore('venue', { display_name: 'Venue Display' }),
		native_token: { symbol: 'V', name: 'Venue Token', coingecko_id: 'venue-token', url: '/token/V' },
		promotions: [],
		kpis: [{ key: 'status', label: 'Status', type: 'badge', value: 'Available', tone: 'positive' }],
		groups: [
			{
				key: 'identity',
				title: 'Identity',
				fields: [{ key: 'legal-name', label: 'Legal name', type: 'text', value: 'Venue Ltd', comparable: true }]
			}
		],
		last_updated: '2026-07-14T00:01:00Z'
	}
}

export function qualityRanksResponse(generatedAt = '2026-08-24'): MasterQualityRanksResponse {
	return {
		generated_at: generatedAt,
		last_updated: '2026-08-24T00:00:00Z',
		venues: { venue: { score: 80, tier: 'A', rank: 1, segments: { linear_perp: 1 }, components: { E: 75 } } }
	}
}

export function rankMethodologyResponse(ranksGeneratedAt = '2026-08-24'): MasterRankMethodologyResponse {
	return {
		components: [{ key: 'E', label: 'Execution', weight: 33, what: 'Execution quality.', na: 'Not measured.' }],
		exec_subs: [],
		flags: [],
		ranks_generated_at: ranksGeneratedAt,
		last_updated: '2026-08-24T00:00:00Z'
	}
}

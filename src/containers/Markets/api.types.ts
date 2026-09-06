import type { MasterExchangePair } from '~/containers/Exchanges/master.types'
import type { Segment } from './segments'

export type MarketVenue = 'dex' | 'cex'

export interface MarketSegmentSummary {
	exchange_count: number
	funding_rate_8h: number | null
	leverage_max: number | null
	leverage_min: number | null
	market_count: number
	oi_prev_usd: number | null
	oi_usd: number | null
	price: number | null
	price_change_24h: number | null
	volume_24h: number
	volume_prev_24h: number | null
}

export interface MarketPair extends MasterExchangePair {
	slug: string
	display_name: string
	type: MarketVenue
}

export interface MarketCategoryTotals {
	pair_count: number
	total_volume_24h: number
	total_oi_usd: number | null
}

export type MarketPairsBySegment = Record<Segment, Array<MarketPair>>
export type MarketTotalsBySegment = Record<Segment, MarketCategoryTotals>

export interface TokenMarketsListEntry {
	exchange_count: number
	market_count: number
	segments: Partial<Record<Segment, MarketSegmentSummary>>
	symbol: string
	tags: Array<string>
	total_oi_usd: number | null
	total_volume_24h: number
}

export interface TokenMarketsListResponse {
	last_updated: string
	tokens: Array<TokenMarketsListEntry>
}

export interface TokenExchangeListingVenue {
	slug: string
	display_name: string
	type: MarketVenue
	segments: Array<Segment>
}

export interface TokenExchangeListing {
	coingecko_id: string
	name: string
	symbol: string
	venues: Array<TokenExchangeListingVenue>
}

export interface TokenExchangeListingsResponse {
	last_updated: string
	tokens: Array<TokenExchangeListing>
}

export interface TokenMarketsResponse {
	symbol: string
	last_updated: string
	depth_bands: Array<number>
	exchange_count: number
	market_count: number
	segments: Partial<Record<Segment, MarketSegmentSummary>>
	tags: Array<string>
	total_oi_usd: number | null
	total_volume_24h: number
	cex: MarketPairsBySegment
	dex: MarketPairsBySegment
	totals: Record<MarketVenue, MarketTotalsBySegment>
}

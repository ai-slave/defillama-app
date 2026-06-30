import type { Segment } from './segments'

export type MarketVenue = 'dex' | 'cex'
export type MarketType = 'spot' | 'perpetual'
export type ExchangeMetadataEuStatus = 'available' | 'leaving' | 'restricted' | 'unavailable'

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

export interface MarketPair {
	exchange: string
	exchange_type: MarketVenue
	market_type: MarketType
	contract_type: '' | 'linear' | 'inverse'
	base: string
	quote: string
	settle_asset: string
	pair_id: string
	market_id: string
	pair_url: string
	symbol: string
	price: number | null
	price_change_24h: number | null
	volume_24h: number | null
	volume_prev_24h: number | null
	oi: number | null
	oi_usd: number | null
	oi_prev_usd: number | null
	funding_rate_8h: number | null
	funding_period_h: number | null
	max_leverage: number | null
	maker_fee: number | null
	taker_fee: number | null
	amount_precision: number | null
	price_precision: number | null
	contract_size: number
	expiry_ts: number | null
	listed_ts: number | null
	min_order_cost: number | null
}

export interface MarketCategoryTotals {
	pair_count: number
	total_volume_24h: number
	total_oi_usd: number | null
}

export type MarketPairsBySegment = Record<Segment, MarketPair[]>
export type MarketTotalsBySegment = Record<Segment, MarketCategoryTotals>

interface TokenMarketsListEntry {
	exchange_count: number
	market_count: number
	segments: Partial<Record<Segment, MarketSegmentSummary>>
	symbol: string
	tags: string[]
	total_oi_usd: number | null
	total_volume_24h: number
}

export interface TokenMarketsListResponse {
	last_updated: string
	tokens: TokenMarketsListEntry[]
}

export interface TokenMarketsResponse {
	symbol: string
	last_updated: string
	exchange_count: number
	market_count: number
	segments: Partial<Record<Segment, MarketSegmentSummary>>
	tags: string[]
	total_oi_usd: number | null
	total_volume_24h: number
	cex: MarketPairsBySegment
	dex: MarketPairsBySegment
	totals: Record<MarketVenue, MarketTotalsBySegment>
}

export interface MarketsCategorySegmentStat {
	funding_rate_8h: number | null
	leverage_max: number | null
	leverage_min: number | null
	market_count: number
	oi_prev_usd: number | null
	oi_usd: number | null
	price_change_24h: number | null
	token_count: number
	volume_24h: number
	volume_prev_24h: number | null
}

interface MarketsCategoryEntry {
	category: string
	segments: Partial<Record<Segment, MarketsCategorySegmentStat>>
}

export interface MarketsCategoriesListResponse {
	categories: MarketsCategoryEntry[]
	last_updated: string
}

export interface MarketsExchangeSeriesApiRow {
	day: number
	exchange: string
	exchange_type: 'cex' | 'dex'
	market_count: number
	oi_usd: number | null
	segment: Segment
	volume_24h: number
}

export interface MarketsExchangeSeriesResponse {
	days: number
	last_updated: string
	series: MarketsExchangeSeriesApiRow[]
}

export interface MarketsCategorySeriesApiRow {
	category: string
	day: number
	market_count: number
	oi_usd: number | null
	segment: Segment
	volume_24h: number
}

export interface MarketsCategoriesSeriesResponse {
	days: number
	last_updated: string
	series: MarketsCategorySeriesApiRow[]
}

export interface MarketsCategoryPageSeriesApiRow {
	day: number
	market_count: number
	oi_usd: number | null
	segment: Segment
	volume_24h: number
}

export interface MarketsCategoryPageExchangeSeriesApiRow extends MarketsCategoryPageSeriesApiRow {
	exchange: string
	exchange_type: 'cex' | 'dex'
}

export interface MarketsCategoryPagePairSeriesApiRow extends MarketsCategoryPageSeriesApiRow {
	pair: string
}

export interface MarketsCategoryTokenRow extends MarketSegmentSummary {
	symbol: string
	tags: string[]
}

export interface MarketsCategoryPageResponse {
	category: string
	last_updated: string
	segments: Partial<Record<Segment, MarketsCategorySegmentStat>>
	series: MarketsCategoryPageSeriesApiRow[]
	series_by_exchange: MarketsCategoryPageExchangeSeriesApiRow[]
	series_by_pair: MarketsCategoryPagePairSeriesApiRow[]
	tokens: Partial<Record<Segment, MarketsCategoryTokenRow[]>>
}

interface MarketsExchangeListTotals {
	exchange_count: number
	total_oi_prev_usd: number | null
	total_oi_usd: number | null
	total_volume_24h: number
	total_volume_prev_24h: number | null
}

export interface MarketsExchangeListEntry {
	defillama_slug: string | null
	exchange: string
	market_count: number
	supports_funding?: boolean
	supports_oi?: boolean
	total_oi_prev_usd?: number | null
	total_oi_usd?: number | null
	total_volume_24h: number
	total_volume_prev_24h: number | null
}

export interface ExchangeMarketsListResponse {
	cex: Record<Segment, MarketsExchangeListEntry[]>
	dex: Record<Segment, MarketsExchangeListEntry[]>
	last_updated: string
	totals: Record<MarketVenue, Record<Segment, MarketsExchangeListTotals>>
}

export interface ExchangeMarketCategoryData {
	market_count: number
	pairs: MarketPair[]
	total_oi_usd: number | null
	total_oi_prev_usd: number | null
	total_volume_24h: number
	total_volume_prev_24h: number | null
}

export interface ExchangeMarketsResponse {
	categories: Partial<Record<Segment, ExchangeMarketCategoryData>>
	defillama_slug: string | null
	exchange: string
	exchange_type: MarketVenue
	last_updated: string
	market_count: number
	market_types: MarketType[]
	supports_funding: boolean
	supports_oi: boolean
	total_oi_usd: number | null
	total_oi_prev_usd: number | null
	total_volume_24h: number
	total_volume_prev_24h: number | null
}

interface ExchangeMetadataFee {
	maker: number | null
	taker: number | null
}

interface ExchangeMetadataFeeToken {
	discount_pct: number | null
	symbol: string
}

type ExchangeMetadataMicaStatus = 'active' | 'in-progress'

// One flat row per exchange from `exchanges/metadata-list.json` — the MiCA/EU
// migration feed. Drives defillama.com/mica.
export interface ExchangeMetadataListEntry {
	available_regions: string[]
	clean_reserves_usd: number | null
	defillama_slug: string | null
	display_name: string
	eu_status: ExchangeMetadataEuStatus | null
	exchange: string
	fee_token: ExchangeMetadataFeeToken | null
	inflows_24h_usd: number | null
	kyc_required: boolean | null
	last_verified: string | null
	mica_licensed: boolean
	mica_member_state: string | null
	mica_status: ExchangeMetadataMicaStatus | null
	native_token: string | null
	oi_usd: number | null
	own_token_pct: number | null
	perp_fee: ExchangeMetadataFee
	products: string[]
	ref_link: string | null
	reserves_source_url: string | null
	reserves_usd: number | null
	restricted_regions: string[]
	// Feature-light / lower-priority MiCA venue (broker, bank, ramp). Curated on the
	// backend; the feed is emitted secondary-last, alpha within tier.
	secondary: boolean
	spot_fee: ExchangeMetadataFee
	volume_24h_usd: number | null
	website: string | null
}

export interface ExchangeMetadataListResponse {
	exchanges: ExchangeMetadataListEntry[]
	last_updated: string
}

interface ExchangeMetadataSource {
	asOf?: string
	note?: string
	url: string
}

interface ExchangeMetadataLinkValue {
	label: string
	url: string
}

type ExchangeMetadataTableCell = string | number | boolean | string[] | ExchangeMetadataLinkValue | null

type ExchangeMetadataFieldValue =
	| string
	| number
	| boolean
	| string[]
	| ExchangeMetadataLinkValue
	| ExchangeMetadataLinkValue[]
	| Record<string, ExchangeMetadataTableCell>[]

type ExchangeMetadataFieldType =
	| 'badge'
	| 'bool'
	| 'link'
	| 'links'
	| 'number'
	| 'pct'
	| 'pills'
	| 'table'
	| 'text'
	| 'usd'

type ExchangeMetadataTone = 'caution' | 'neutral'

interface ExchangeMetadataTableColumn {
	align?: string
	format?: string
	key: string
	label: string
}

interface ExchangeMetadataField {
	columns?: ExchangeMetadataTableColumn[]
	comparable: boolean
	key: string
	label: string
	source?: ExchangeMetadataSource
	tone?: ExchangeMetadataTone
	type: ExchangeMetadataFieldType
	value: ExchangeMetadataFieldValue
}

interface ExchangeMetadataGroup {
	fields: ExchangeMetadataField[]
	fromPor?: boolean
	key: string
	source?: ExchangeMetadataSource
	title: string
}

interface ExchangeMetadataKpi {
	key: string
	label: string
	source?: ExchangeMetadataSource
	tone?: ExchangeMetadataTone
	type: ExchangeMetadataFieldType
	value: ExchangeMetadataFieldValue
}

interface ExchangeMetadataToken {
	symbol: string
	url: string
}

export interface ExchangeMetadataResponse {
	defillama: {
		cex_url: string
		slug: string
	} | null
	display_name: string
	exchange: string
	groups: ExchangeMetadataGroup[]
	kpis: ExchangeMetadataKpi[]
	last_updated: string
	native_token: ExchangeMetadataToken | null
	website: string | null
}

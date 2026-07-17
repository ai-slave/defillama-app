/**
 * Exact DTOs emitted by the canonical Markets API contract (orderbook-watch exchanges cache).
 *
 * Canonical sources in the backend repo: docs/exchanges-api.md,
 * lib/exchange-contract.ts (PublicVenueCore), lib/cache-builders.ts
 * (directory/index/mica/series builders) and lib/chart-contract.ts
 * (global chart bundle). Market segments are always explicit: there is no
 * combined-perpetual scope anywhere on the wire.
 */

export type MasterSegment = 'spot' | 'linear_perp' | 'inverse_perp'
export type MasterVenueType = 'cex' | 'dex'
export type MasterEuStatus = 'available' | 'restricted' | 'leaving' | 'unavailable'
export type MasterMicaStatus = 'active' | 'in-progress'
export type MasterDirectoryVisibility = 'listed' | 'mica-only'
export type MasterProfileMode = 'markets' | 'metadata-only'

export const MASTER_SEGMENTS = ['spot', 'linear_perp', 'inverse_perp'] as const satisfies readonly MasterSegment[]

// --- Shared venue core (buildPublicVenueCore) --------------------------------

export type MasterEntityScope = { kind: 'global' } | { kind: 'regional'; regions: string[] }

export interface MasterRelatedEntity {
	slug: string
	name: string
	scope: MasterEntityScope
	profile_url: string
}

export type MasterLiquidityRelation =
	| { mode: 'own' }
	| {
			mode: 'shared'
			/** 'full' presents the entire source book; 'subset' tracks a filtered slice. */
			coverage: 'full' | 'subset'
			source: { slug: string; name: string; profile_url: string }
	  }

/** Every segment key is present; null means the segment is absent for the venue. */
export type MasterLiquidityBySegment = Record<MasterSegment, MasterLiquidityRelation | null>

export interface MasterWebsiteDestination {
	url: string
	kind: 'referral' | 'official'
}

export interface MasterDefillamaLink {
	slug: string
	type: 'cex' | 'protocol'
	url: string
}

export interface MasterVenueCore {
	slug: string
	display_name: string
	type: MasterVenueType
	directory_visibility: MasterDirectoryVisibility
	profile_mode: MasterProfileMode
	scope: MasterEntityScope
	parent_entity: MasterRelatedEntity | null
	related_entities: MasterRelatedEntity[]
	liquidity: MasterLiquidityBySegment
	links: {
		profile: string
		website: MasterWebsiteDestination | null
		defillama: MasterDefillamaLink | null
	}
}

// --- Shared blocks ------------------------------------------------------------

export interface MasterFreshness {
	volume: string | null
	oi: string | null
	funding: string | null
	depth: string | null
}

export interface MasterCapabilityFlags {
	oi: boolean
	funding: boolean
	depth: boolean
}

export interface MasterDoubleCount {
	volume?: string
	oi?: string
	depth?: string
}

export interface MasterSegmentStats {
	markets: number
	coins: number
	volume_24h: number | null
	volume_prev_24h: number | null
	oi_usd?: number | null
	oi_prev_usd?: number | null
	depth_2pct_bid_usd: number | null
	depth_2pct_ask_usd: number | null
	depth_partial: boolean
	freshness: MasterFreshness
	doublecount?: MasterDoubleCount
}

export interface MasterSegmentNormalizedVolume {
	reported: number
	normalized: number
	discount_pct: number
	unverified_pct: number
	flag: string | null
}

export interface MasterWarning {
	level: 'info' | 'caution' | 'danger'
	text: string
	expiry?: string
}

export interface MasterFeePair {
	maker: number | null
	taker: number | null
}

export interface MasterRampLegCost {
	fiat_fee_usd: number | null
	trade_fee_usd: number | null
	slippage_usd: number | null
	transfer_fee_usd: number | null
	total_usd: number | null
	total_pct: number | null
}

export interface MasterRampCost {
	notional_usd: number
	pair: string | null
	on_ramp: MasterRampLegCost
	off_ramp: MasterRampLegCost
	assumptions: {
		method: string
		taker_fee: number | null
		half_spread_pct: number | null
		btc_withdrawal_fee_btc: number | null
		btc_network_fee_btc: number | null
		btc_price_usd: number | null
	}
}

export interface MasterFiatFeeRow {
	currency: string
	fee: string
	method: string
	min: string
	note: string
	src: MasterMetadataLink
	time: string
}

export interface MasterFiatFees {
	on_ramp: MasterFiatFeeRow[]
	off_ramp: MasterFiatFeeRow[]
}

// --- exchanges/directory.json --------------------------------------------------

export interface MasterVenueTotals {
	spot_volume_24h: number | null
	linear_perp_volume_24h: number | null
	inverse_perp_volume_24h: number | null
	total_trading_volume_24h: number | null
	coins: number | null
}

export interface MasterDirectoryVenue extends MasterVenueCore {
	directory_visibility: 'listed'
	tracked: boolean
	secondary: boolean
	segments: Partial<Record<MasterSegment, MasterSegmentStats>>
	capabilities: Partial<Record<MasterSegment, MasterCapabilityFlags>>
	totals: MasterVenueTotals
	sparks: Partial<Record<MasterSegment, number[]>>
	freshness: MasterFreshness
	reserves: {
		total_usd: number | null
		clean_usd: number | null
		own_token_pct: number | null
		inflows_24h_usd: number | null
		inflows_7d_usd: number | null
		inflows_1m_usd: number | null
		auditor: string | null
		source_url: string | null
	} | null
	fees: {
		spot: MasterFeePair | null
		linear_perp: MasterFeePair | null
		inverse_perp: MasterFeePair | null
		fee_token: { symbol: string; discount_pct: number | null } | null
	} | null
	compliance: {
		hq: string | null
		eu_status: MasterEuStatus | null
		mica: {
			status: MasterMicaStatus
			licensed: boolean | null
			member_state: string | null
			regulator: string | null
		} | null
		license_count: number | null
		kyc: { required: boolean; short: string | null; summary: string | null } | null
		available_regions: string[]
		restricted_regions: string[]
	} | null
	profile: {
		founded: number | null
		native_token: string | null
		promotions: MasterPromotion[]
		last_verified: string | null
	} | null
	funding: {
		fiat_currencies: string[] | null
		has_fiat_onramp: boolean | null
		fiat_fees: MasterFiatFees | null
		ramp_cost_1k: MasterRampCost | null
	} | null
	warnings: MasterWarning[]
	nvol: Record<MasterSegment, MasterSegmentNormalizedVolume | null>
}

export interface MasterDirectoryTotals {
	venues: number
	tracked: number
	spot_volume_24h: number | null
	linear_perp_volume_24h: number | null
	inverse_perp_volume_24h: number | null
	total_trading_volume_24h: number | null
	reserves_usd: number | null
}

export interface MasterDirectoryResponse {
	venues: MasterDirectoryVenue[]
	totals: MasterDirectoryTotals & { cex: MasterDirectoryTotals; dex: MasterDirectoryTotals }
	freshness: MasterFreshness
	last_updated: string
}

// --- Columnar series (exchanges/series.json and exchanges/{slug}/series.json) ---

/**
 * Compact columnar series. `series[i]` is aligned to `days` and named by `key[i]`;
 * a null column means the metric is unsupported for the venue, a null cell is a
 * missing observation. The aggregate file uses AGG keys
 * (cex/dex/total × spot/linear_perp/inverse_perp volume + perp OI +
 * total_trading_volume); per-venue files use the 19 exact venue keys.
 */
export interface MasterColumnarSeriesResponse {
	days: number[]
	key: string[]
	series: Array<Array<number | null> | null>
	freshness?: {
		first_day: number | null
		last_day: number | null
		expected_last_day: number | null
		stale: boolean
		metrics: Record<string, { last_day: number | null; stale: boolean }>
	}
	last_updated: string
}

// --- exchanges/{slug}/index.json -------------------------------------------------

export interface MasterPairNormalizedVolume {
	reported: number
	normalized: number
	active_liquidity: number
	band: number
	daily_vol: number
	coverage: number
	status: 'covered' | 'estimated' | 'no_depth'
	category: string | null
	flag: string | null
}

/** Pair rows keep `market_id` as opaque identity but carry no venue fields. */
export interface MasterExchangePair {
	market_type: 'spot' | 'perpetual'
	contract_type: '' | 'linear' | 'inverse'
	base: string
	quote: string
	pair_id: string
	market_id: string
	pair_url: string
	symbol: string
	price: number | null
	mark_price: number | null
	index_price: number | null
	price_change_24h: number | null
	volume_24h: number | null
	volume_prev_24h: number | null
	oi: number | null
	oi_usd: number | null
	oi_prev_usd: number | null
	funding_rate_8h: number | null
	contract_size: number
	settle_asset: string
	funding_period_h: number | null
	next_funding_ts: number | null
	expiry_ts: number | null
	listed_ts: number | null
	max_leverage: number | null
	taker_fee: number | null
	maker_fee: number | null
	price_precision: number | null
	amount_precision: number | null
	min_order_cost: number | null
	best_bid: number | null
	best_ask: number | null
	depth_bid_usd: number[] | null
	depth_ask_usd: number[] | null
	depth_bid_max_dist: number | null
	depth_ask_max_dist: number | null
	nvol: MasterPairNormalizedVolume | null
	volume_change_24h: number | null
	oi_change_24h: number | null
	freshness: MasterFreshness
}

export interface MasterExchangeIndexSegment {
	markets: number
	coins: number
	volume_24h: number | null
	volume_prev_24h: number | null
	oi_usd?: number | null
	oi_prev_usd?: number | null
	freshness: MasterFreshness
	doublecount?: MasterDoubleCount
	pairs: MasterExchangePair[]
}

export interface MasterExchangeIndexResponse {
	slug: string
	type: MasterVenueType
	liquidity: MasterLiquidityBySegment
	segments: Partial<Record<MasterSegment, MasterExchangeIndexSegment>>
	capabilities: Partial<Record<MasterSegment, MasterCapabilityFlags>>
	freshness: MasterFreshness
	depth_bands: number[]
	last_updated: string
}

// --- exchanges/{slug}/metadata.json -----------------------------------------------

export type MasterMetadataScalarFormat = 'text' | 'number' | 'usd' | 'pct' | 'date' | 'bool' | 'link'

export type MasterMetadataTone = 'positive' | 'caution' | 'negative' | 'neutral'
export type MasterMetadataGroupKey =
	| 'identity'
	| 'links'
	| 'security'
	| 'proof_of_reserves'
	| 'regulation'
	| 'products'
	| 'funding'
	| 'kyc'
	| 'fees'
	| 'metrics'
export interface MasterMetadataSource {
	url: string
	asOf?: string
	note?: string
}
export interface MasterMetadataLink {
	label: string
	url: string
}
export type MasterMetadataCell = string | number | boolean | string[] | MasterMetadataLink | null

interface MasterMetadataValueBase {
	key: string
	label: string
	source?: MasterMetadataSource
}

export interface MasterMetadataTableColumn {
	key: string
	label: string
	format?: MasterMetadataScalarFormat
	align?: 'left' | 'right'
}

type MasterMetadataNonTableValue = MasterMetadataValueBase &
	(
		| { type: 'text' | 'date'; value: string }
		| { type: 'number' | 'usd' | 'pct'; value: number }
		| { type: 'bool'; value: boolean }
		| { type: 'badge'; value: string; tone?: MasterMetadataTone }
		| { type: 'pills'; value: string[] }
		| { type: 'link'; value: MasterMetadataLink }
		| { type: 'links'; value: MasterMetadataLink[] }
		| { type: 'kv'; value: Array<{ label: string; value: MasterMetadataCell }> }
	)

export type MasterMetadataField =
	| (MasterMetadataNonTableValue & { comparable: boolean })
	| (MasterMetadataValueBase & {
			type: 'table'
			value: Array<Record<string, MasterMetadataCell>>
			columns: MasterMetadataTableColumn[]
			comparable: boolean
	  })

export interface MasterMetadataGroup {
	key: MasterMetadataGroupKey
	title: string
	fromPor?: boolean
	fields: MasterMetadataField[]
	source?: MasterMetadataSource
}

export type MasterMetadataKpi = MasterMetadataNonTableValue

export interface MasterPromotion {
	title: string
	label: string
	subtitle?: string
	type: 'deposit_bonus' | 'cashback' | 'fee_discount' | 'prize_draw' | 'referral' | 'other'
	regions?: string[]
	excluded_regions?: string[]
	url?: string
	terms_url?: string
	starts_at?: string
	ends_at?: string
	priority?: number
	source: MasterMetadataSource
}

export interface MasterExchangeMetadataResponse extends MasterVenueCore {
	available_regions: string[]
	restricted_regions: string[]
	native_token: { symbol: string; url: string } | null
	promotions: MasterPromotion[]
	kpis: MasterMetadataKpi[]
	groups: MasterMetadataGroup[]
	last_updated: string
}

// --- exchanges/mica.json ------------------------------------------------------------

export interface MasterMicaDepthSegment {
	bid_2pct_usd: number | null
	ask_2pct_usd: number | null
	bid_05pct_usd: number | null
	ask_05pct_usd: number | null
	partial: boolean
}

export interface MasterMicaSegmentMetrics {
	volume_24h_usd: number | null
	oi_usd: number | null
	market_count: number | null
}

export type MasterMicaProduct = MasterSegment | 'margin' | 'futures' | 'options'

export interface MasterMicaVenue extends MasterVenueCore {
	native_token: string | null
	founded: number | null
	hq: string | null
	license_count: number | null
	fiat_currency_count: number | null
	has_fiat_onramp: boolean
	fiat_fees: MasterFiatFees | null
	warnings: MasterWarning[]
	ramp_cost_1k: MasterRampCost | null
	depth_summary: Record<MasterSegment, MasterMicaDepthSegment | null>
	eu_status: MasterEuStatus | null
	mica_status: MasterMicaStatus | null
	mica_licensed: boolean | null
	mica_member_state: string | null
	mica_regulator: string | null
	available_regions: string[]
	restricted_regions: string[]
	products: MasterMicaProduct[]
	promotions: MasterPromotion[]
	kyc_required: boolean | null
	kyc_short: string | null
	kyc_summary: string | null
	fees: Record<MasterSegment, MasterFeePair | null>
	fee_token: { symbol: string; discount_pct: number | null } | null
	reserves_usd: number | null
	reserves_source_url: string | null
	clean_reserves_usd: number | null
	own_token_pct: number | null
	inflows_24h_usd: number | null
	metrics: Record<MasterSegment, MasterMicaSegmentMetrics | null>
	total_trading_volume_24h: number | null
	last_verified: string | null
	secondary: boolean
}

export interface MasterMicaResponse {
	exchanges: MasterMicaVenue[]
	last_updated: string
}

// --- charts/{volume,oi,depth,nvol}.json ----------------------------------------------

export const MASTER_CHART_PARTS = ['volume', 'oi', 'depth', 'nvol'] as const

export type MasterChartPart = (typeof MASTER_CHART_PARTS)[number]

export type MasterChartMetric =
	| 'spot'
	| 'linear_perp'
	| 'inverse_perp'
	| 'spot_mkts'
	| 'linear_perp_mkts'
	| 'inverse_perp_mkts'
	| 'reported_spot'
	| 'reported_linear_perp'
	| 'reported_inverse_perp'

/** Exact ordered key schema per chart part (lib/chart-contract.ts GLOBAL_CHART_KEYS). */
export const MASTER_CHART_KEYS = {
	volume: ['spot', 'linear_perp', 'inverse_perp', 'spot_mkts', 'linear_perp_mkts', 'inverse_perp_mkts'],
	oi: ['linear_perp', 'inverse_perp'],
	depth: ['spot', 'linear_perp', 'inverse_perp'],
	nvol: ['spot', 'linear_perp', 'inverse_perp', 'reported_spot', 'reported_linear_perp', 'reported_inverse_perp']
} as const satisfies Record<MasterChartPart, readonly MasterChartMetric[]>

/**
 * Compact columnar shape of the global chart files (`charts/{part}.json`).
 * `series[exchangeIdx][keyIdx]` is the per-day array for `exchanges[exchangeIdx]` /
 * `key[keyIdx]`, aligned to `days`, or null when that venue lacks the metric.
 * `exchanges[]` and `names` keys are canonical public slugs; all four parts share
 * identical exchanges/types/names/day axes. `btc_depth` (depth part only) is keyed
 * by all three segments.
 */
interface MasterChartColumnarBase {
	days: number[]
	exchanges: string[]
	types: MasterVenueType[]
	series: Array<Array<Array<number | null> | null>>
	btc_depth?: Record<MasterSegment, Array<number | null>>
	names: Record<string, string>
	last_updated?: string
	built_at?: string
}

export type MasterChartColumnarResponse<Part extends MasterChartPart = MasterChartPart> = MasterChartColumnarBase & {
	key: (typeof MASTER_CHART_KEYS)[Part]
}

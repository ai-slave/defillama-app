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

export const MASTER_SEGMENTS = ['spot', 'linear_perp', 'inverse_perp'] as const satisfies ReadonlyArray<MasterSegment>

// --- Shared venue core (buildPublicVenueCore) --------------------------------

export type MasterEntityScope = { kind: 'global' } | { kind: 'regional'; regions: Array<string> }

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
	related_entities: Array<MasterRelatedEntity>
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
	depth_ladder: MasterDepthLadder | null
	freshness: MasterFreshness
	doublecount?: MasterDoubleCount
}

/**
 * Cumulative USD depth per `MasterDirectoryResponse.depth_bands`, summed over the
 * segment's pairs. `coverage[i]` is the share of the segment's volume whose book
 * genuinely reached that band — past a pair's reach the upstream sums are
 * forward-filled, so a ladder flattens at the fetch limit and the flat part must
 * be drawn as unmeasured, not as thin liquidity.
 */
export interface MasterDepthLadder {
	bid_usd: Array<number | null>
	ask_usd: Array<number | null>
	coverage: Array<number>
}

export interface MasterSegmentNormalizedVolume {
	reported: number
	normalized: number
	/** Volatility-band depth INCLUDING the extrapolated part past our snapshot's
	 *  reach. This is what `normalized` was capped against; it is not displayed. */
	active_liquidity: number
	/** The same band with the extrapolation stripped — observed depth only. This is
	 *  the figure surfaces show, because a displayed liquidity number has to be
	 *  liquidity that exists. */
	active_liquidity_measured: number
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
	src: MasterMetadataLink | null
	time: string
}

export interface MasterFiatFees {
	on_ramp: Array<MasterFiatFeeRow>
	off_ramp: Array<MasterFiatFeeRow>
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
	sparks: Partial<Record<MasterSegment, Array<number>>>
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
	} | null
	profile: {
		founded: number | null
		native_token: string | null
		promotions: Array<MasterPromotion>
		last_verified: string | null
	} | null
	funding: {
		fiat_currencies: Array<string> | null
		has_fiat_onramp: boolean | null
		fiat_fees: MasterFiatFees | null
		ramp_cost_1k: MasterRampCost | null
	} | null
	warnings: Array<MasterWarning>
	regional: Pick<MasterExchangeRegionManifestResponse, 'variants'> | null
	nvol: Record<MasterSegment, MasterSegmentNormalizedVolume | null>
	rank: MasterVenueRank | null
}

/** The venue's REAL score (Reserves, Execution, Activity, Liquidity), stamped from a
 * manually refreshed upstream file — null for a venue not scored yet. `score` is the
 * 0–100 composite and IS comparable across CEX and DEX (the popularity component
 * applies to both), so it is what a mixed table sorts on; `rank` is the position within
 * the venue's own kind and only breaks ties. `components` is the pillar breakdown.
 * Published on the directory and the ramps payloads alike. */
export interface MasterVenueRank {
	score: number
	rank: number
	/** Public tier band (S ≥85, A ≥70, B ≥55, C ≥40, else D); S additionally
	 * requires measured execution. */
	tier: string
	segments: Partial<Record<MasterSegment, number>>
	components: Record<string, number | null>
}

interface MasterExecutionMeasurements {
	cost_to_trade_bps: number | null
	effective_spread_bps: number | null
	quoted_spread_bps: number | null
	realized_slippage_bps_10k: number | null
	realized_slippage_bps_100k: number | null
	realized_slippage_bps_1m: number | null
	predicted_slippage_bps_10k: number | null
	predicted_slippage_bps_100k: number | null
	predicted_slippage_bps_1m: number | null
	slip_gap_bps_10k: number | null
	slip_gap_bps_100k: number | null
	markout_bps_1s: number | null
	markout_bps_15s: number | null
	markout_bps_1m: number | null
	markout_bps_5m: number | null
	taker_fee_bps: number | null
}

/** Measured execution quality (tick-level fills on the shared perp basket) —
 * `exchanges/execution-quality.json`. USD perps only today. */
export interface MasterExecutionPairMetrics extends MasterExecutionMeasurements {
	asset: string
	symbol: string
	hours_covered: number
	n_trades: number
}

/** BTC book-feed health for the venue's captured tick feed (latest measured day). A
 * degraded reading can come from the data pipeline rather than the venue, so it is
 * disclosed, never scored. */
export interface MasterExecutionFeedHealth {
	date: string
	avg_gap_ms: number
	median_gap_ms: number
	p99_gap_ms: number
	max_gap_ms: number
	downtime_s: number
	degraded: boolean
}

export interface MasterExecutionVenueMetrics extends MasterExecutionMeasurements {
	assets: Array<string>
	pair_count: number
	hours_covered: number
	n_trades: number
	feed?: MasterExecutionFeedHealth
	pairs: Record<string, MasterExecutionPairMetrics>
}

/** The trimmed slippage feed the token order-book chart reads, keyed by venue slug
 *  then uppercase asset. `symbol` identifies the exact book those fills measured. */
export interface MasterExecutionSlippageResponse {
	venues: Record<string, Record<string, { symbol: string; predictedBps: number | null; realizedBps: number | null }>>
}

export interface MasterExecutionQualityResponse {
	basket: Array<string>
	unit: string
	unit_note: string
	venues: Record<string, MasterExecutionVenueMetrics>
}

/** Committed quality scores — `exchanges/quality-ranks.json`. `rank` is the position
 * within the venue's own kind; `score` is cross-comparable. */
export interface MasterQualityRanksResponse {
	generated_at: string
	last_updated: string
	venues: Record<
		string,
		{
			score: number
			tier: string
			rank: number
			segments: Partial<Record<MasterSegment, number>>
			components: Record<string, number | null>
			/** Execution sub-scores (markout/cost/slip, 0–100 peer-relative) behind
			 * components.E; present only when at least one sub was measured. */
			exec_subs?: Record<string, number | null>
			/** Delivery-vs-quote score (0–100) whose shortfall discounts components.E. */
			exec_delivery?: number | null
			/** Reserves sub-scores (magnitude/consistency, 0–100) behind components.R;
			 * present whenever the venue has a reserves figure. */
			reserve_subs?: Record<string, number | null>
		}
	>
	/** Venues with no observed book — listed, never scored. */
	insufficient_data?: Array<string>
}

/** Published ranking catalog — `exchanges/rank-methodology.json`: what each pillar
 * measures and what it weighs, so the profile breakdown can't describe stale math. */
export interface MasterRankMethodologyResponse {
	components: Array<{ key: string; label: string; weight: number; what: string; na: string }>
	exec_subs: Array<{ key: string; label: string; weight: number; what: string }>
	/** Optional until every upstream build ships it. */
	reserve_subs?: Array<{ key: string; label: string; weight: number; what: string }>
	flags: Array<{ key: string; label: string; what: string }>
	ranks_generated_at: string | null
	last_updated: string
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
	venues: Array<MasterDirectoryVenue>
	/** One band axis (fractions of mid) for every venue's `depth_ladder`. */
	depth_bands: Array<number>
	totals: MasterDirectoryTotals & { cex: MasterDirectoryTotals; dex: MasterDirectoryTotals }
	freshness: MasterFreshness
	last_updated: string
}

// --- Ranged columnar series (exchanges/series/{range}.json and exchanges/{slug}/series/{range}.json) ---

export const MASTER_AGGREGATE_SERIES_KEYS = [
	'cex_spot_volume',
	'cex_linear_perp_volume',
	'cex_inverse_perp_volume',
	'cex_linear_perp_oi',
	'cex_inverse_perp_oi',
	'dex_spot_volume',
	'dex_linear_perp_volume',
	'dex_inverse_perp_volume',
	'dex_linear_perp_oi',
	'dex_inverse_perp_oi',
	'total_spot_volume',
	'total_linear_perp_volume',
	'total_inverse_perp_volume',
	'total_linear_perp_oi',
	'total_inverse_perp_oi',
	'total_trading_volume',
	// Observed active liquidity (extrapolation stripped). Spot and USD perps only —
	// the segments normalized volume supports.
	'cex_spot_active_liquidity',
	'cex_linear_perp_active_liquidity',
	'dex_spot_active_liquidity',
	'dex_linear_perp_active_liquidity',
	'total_spot_active_liquidity',
	'total_linear_perp_active_liquidity'
] as const

export const MASTER_VENUE_SERIES_KEYS = [
	'spot_volume',
	'linear_perp_volume',
	'inverse_perp_volume',
	'linear_perp_oi',
	'inverse_perp_oi',
	'linear_perp_oi_delta',
	'inverse_perp_oi_delta',
	'spot_depth_2pct',
	'linear_perp_depth_2pct',
	'inverse_perp_depth_2pct',
	'spot_normalized_volume',
	'linear_perp_normalized_volume',
	'inverse_perp_normalized_volume',
	'spot_active_liquidity',
	'linear_perp_active_liquidity',
	'inverse_perp_active_liquidity',
	'spot_reported_volume',
	'linear_perp_reported_volume',
	'inverse_perp_reported_volume',
	'spot_market_count',
	'linear_perp_market_count',
	'inverse_perp_market_count'
] as const

interface MasterColumnarSeriesBase<Key extends ReadonlyArray<string>> {
	days: Array<number>
	key: Key
	series: Array<Array<number | null> | null>
	last_updated: string
}

export type MasterAggregateSeriesResponse = MasterColumnarSeriesBase<typeof MASTER_AGGREGATE_SERIES_KEYS>

export interface MasterVenueSeriesResponse extends MasterColumnarSeriesBase<typeof MASTER_VENUE_SERIES_KEYS> {
	freshness: {
		first_day: number | null
		last_day: number | null
		expected_last_day: number | null
		stale: boolean
		metrics: Record<string, { last_day: number | null; stale: boolean }>
	}
}

export type MasterColumnarSeriesResponse = MasterAggregateSeriesResponse | MasterVenueSeriesResponse

// --- exchanges/{slug}/index.json -------------------------------------------------

export interface MasterPairNormalizedVolume {
	reported: number
	normalized: number
	active_liquidity: number
	active_liquidity_measured: number
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
	base_coingecko_id: string | null
	quote_coingecko_id: string | null
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
	depth_bid_usd: Array<number | null> | null
	depth_ask_usd: Array<number | null> | null
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
	pairs: Array<MasterExchangePair>
}

export interface MasterExchangeIndexResponse {
	slug: string
	type: MasterVenueType
	liquidity: MasterLiquidityBySegment
	segments: Partial<Record<MasterSegment, MasterExchangeIndexSegment>>
	capabilities: Partial<Record<MasterSegment, MasterCapabilityFlags>>
	freshness: MasterFreshness
	depth_bands: Array<number>
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
export type MasterMetadataCell = string | number | boolean | Array<string> | MasterMetadataLink | null

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
		| { type: 'pills'; value: Array<string> }
		| { type: 'link'; value: MasterMetadataLink }
		| { type: 'links'; value: Array<MasterMetadataLink> }
		| { type: 'kv'; value: Array<{ label: string; value: MasterMetadataCell }> }
	)

export type MasterMetadataField =
	| (MasterMetadataNonTableValue & { comparable: boolean })
	| (MasterMetadataValueBase & {
			type: 'table'
			value: Array<Record<string, MasterMetadataCell>>
			columns: Array<MasterMetadataTableColumn>
			comparable: boolean
	  })

export interface MasterMetadataGroup {
	key: MasterMetadataGroupKey
	title: string
	fromPor?: boolean
	fields: Array<MasterMetadataField>
	source?: MasterMetadataSource
}

export type MasterMetadataKpi = MasterMetadataNonTableValue

export interface MasterPromotion {
	title: string
	label: string
	subtitle?: string
	type: 'deposit_bonus' | 'cashback' | 'fee_discount' | 'prize_draw' | 'referral' | 'other'
	regions?: Array<string>
	excluded_regions?: Array<string>
	url?: string
	terms_url?: string
	starts_at?: string
	ends_at?: string
	priority?: number
	source: MasterMetadataSource
}

export interface MasterExchangeMetadataResponse extends MasterVenueCore {
	native_token: { symbol: string; name: string; coingecko_id: string | null; url: string } | null
	promotions: Array<MasterPromotion>
	kpis: Array<MasterMetadataKpi>
	groups: Array<MasterMetadataGroup>
	last_updated: string
}

export interface MasterExchangeRegionCatalogResponse {
	version: string
	countries: Array<string>
	country_regions: Record<string, string>
	regions: Record<string, { label: string; continent: string; countries: Array<string> }>
	last_updated: string
}

type MasterExchangeCountryOverride = {
	status: 'unavailable' | 'restricted'
	note?: string
	source?: MasterMetadataSource
}

type MasterExchangeRegionVariantBase = {
	note: string | null
	source: MasterMetadataSource | null
	country_overrides: Partial<Record<string, MasterExchangeCountryOverride>>
}

export type MasterExchangeRegionVariant = MasterExchangeRegionVariantBase &
	(
		| { status: 'unavailable'; segments: [] }
		| { status: Exclude<MasterEuStatus, 'unavailable'>; segments: Array<MasterSegment> }
	)

export interface MasterExchangeRegionManifestResponse {
	variants: Partial<Record<string, MasterExchangeRegionVariant>> & { global: MasterExchangeRegionVariant }
	last_updated: string
}

/** Response from the app's country-aware metadata route, not a Markets API cache file. */
interface MasterExchangeRegionalMetadataBase {
	country: string
	region: { key: string; label: string }
	segments: Array<MasterSegment>
	note: string | null
	source: MasterMetadataSource | null
	used_fallback: boolean
}

export type MasterExchangeRegionalMetadataResponse =
	| (MasterExchangeRegionalMetadataBase & { availability: 'unavailable'; segments: [] })
	| {
			[Status in Exclude<MasterEuStatus, 'unavailable'>]: MasterExchangeRegionalMetadataBase & {
				availability: Status
				metadata: MasterExchangeMetadataResponse
			}
	  }[Exclude<MasterEuStatus, 'unavailable'>]

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
	warnings: Array<MasterWarning>
	ramp_cost_1k: MasterRampCost | null
	depth_summary: Record<MasterSegment, MasterMicaDepthSegment | null>
	eu_status: MasterEuStatus | null
	mica_status: MasterMicaStatus | null
	mica_licensed: boolean | null
	mica_member_state: string | null
	mica_regulator: string | null
	products: Array<MasterMicaProduct>
	promotions: Array<MasterPromotion>
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
	exchanges: Array<MasterMicaVenue>
	last_updated: string
}

// --- exchanges/ramps.json -----------------------------------------------------------
// Fiat on/off-ramp cost, BTC-only, priced per fiat currency and per region variant.
// Each variant IS a region-manifest variant (same status/segments/note/source/
// country_overrides contract) plus the ramp payload, so a country resolves through
// the same `resolveCountryAvailability` the profile surfaces use.

/** One end-to-end direction: the four legs, and a total only when every leg is known. */
export interface MasterRampLeg {
	fiat_fee_usd: number | null
	trade_fee_usd: number | null
	slippage_usd: number | null
	transfer_fee_usd: number | null
	total_usd: number | null
	total_pct: number | null
}

/** Currency-independent baseline: execution plus the two BTC transfer legs. */
export interface MasterRampTradeLegs {
	pair: string | null
	trade_fee_usd: number | null
	slippage_buy_usd: number | null
	slippage_sell_usd: number | null
	btc_withdrawal_usd: number | null
	btc_network_usd: number | null
}

export interface MasterRampCurrencyCost {
	pair: string | null
	on_ramp: MasterRampLeg
	off_ramp: MasterRampLeg
	on_rail: string | null
	off_rail: string | null
}

export interface MasterRampMatrix {
	sizes: Array<number>
	currencies: Array<string>
	/** Keyed by notional in USD, as a string. */
	trade: Partial<Record<string, MasterRampTradeLegs>>
	/** currency → notional → both directions. */
	cost: Partial<Record<string, Partial<Record<string, MasterRampCurrencyCost>>>>
	assumptions: {
		taker_fee: number | null
		btc_withdrawal_fee_btc: number | null
		btc_network_fee_btc: number | null
		btc_price_usd: number | null
		half_spread_pct: number | null
	}
}

export interface MasterCryptoFeeRow {
	asset: string
	network: string
	direction: 'deposit' | 'withdraw'
	fee: string
	min: string
	note: string
	src: MasterMetadataLink | null
	time: string
}

export interface MasterCryptoRails {
	deposit: Array<MasterCryptoFeeRow>
	withdraw: Array<MasterCryptoFeeRow>
}

export type MasterRampVariant = MasterExchangeRegionVariant & {
	fiat_currencies: Array<string> | null
	rails: MasterFiatFees | null
	/** Chain-side routes: (asset x network x direction), L2s included. */
	crypto_rails: MasterCryptoRails | null
	kyc: { required: boolean | null; short: string | null; summary: string | null }
	regulator: string | null
	mica_licensed: boolean | null
	ramp: MasterRampMatrix
}

export interface MasterRampVenue extends MasterVenueCore {
	variants: Partial<Record<string, MasterRampVariant>>
	rank: MasterVenueRank | null
}

export interface MasterRampsResponse {
	sizes: Array<number>
	btc_network_fee_btc: number | null
	exchanges: Array<MasterRampVenue>
	last_updated: string
}

// --- charts/{volume,oi,depth,nvol}/{range}.json --------------------------------------

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
	| 'active_liquidity_spot'
	| 'active_liquidity_linear_perp'
	| 'active_liquidity_inverse_perp'
	| 'active_liquidity_measured_spot'
	| 'active_liquidity_measured_linear_perp'
	| 'active_liquidity_measured_inverse_perp'

/** Exact ordered key schema per chart part (lib/chart-contract.ts GLOBAL_CHART_KEYS). */
export const MASTER_CHART_KEYS = {
	volume: ['spot', 'linear_perp', 'inverse_perp', 'spot_mkts', 'linear_perp_mkts', 'inverse_perp_mkts'],
	oi: ['linear_perp', 'inverse_perp'],
	depth: ['spot', 'linear_perp', 'inverse_perp'],
	nvol: [
		'spot',
		'linear_perp',
		'inverse_perp',
		'reported_spot',
		'reported_linear_perp',
		'reported_inverse_perp',
		'active_liquidity_spot',
		'active_liquidity_linear_perp',
		'active_liquidity_inverse_perp',
		'active_liquidity_measured_spot',
		'active_liquidity_measured_linear_perp',
		'active_liquidity_measured_inverse_perp'
	]
} as const satisfies Record<MasterChartPart, ReadonlyArray<MasterChartMetric>>

/**
 * Compact columnar shape of a global chart range (`charts/{part}/{range}.json`).
 * `series[exchangeIdx][keyIdx]` is the per-day array for `exchanges[exchangeIdx]` /
 * `key[keyIdx]`, aligned to `days`, or null when that venue lacks the metric.
 * `exchanges[]` and `names` keys are canonical public slugs; all four parts share
 * identical exchanges/types/names. Each part trims its own empty leading period,
 * so day axes may differ. `btc_depth` (depth part only) and `btc_oi` (oi part only)
 * are each keyed by all three segments.
 */
interface MasterChartColumnarBase {
	days: Array<number>
	exchanges: Array<string>
	types: Array<MasterVenueType>
	series: Array<Array<Array<number | null> | null>>
	btc_depth?: Record<MasterSegment, Array<number | null>>
	btc_oi?: Record<MasterSegment, Array<number | null>>
	names: Record<string, string>
	range: '30d' | '90d' | '1y' | '2y' | 'all'
	last_updated?: string
	built_at?: string
}

export type MasterChartColumnarResponse<Part extends MasterChartPart = MasterChartPart> = MasterChartColumnarBase & {
	key: (typeof MASTER_CHART_KEYS)[Part]
}

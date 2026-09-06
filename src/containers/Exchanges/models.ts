/**
 * Backend-neutral read models for the Exchanges product surfaces.
 *
 * Transport modules own upstream DTOs and are responsible for mapping one
 * active contract into these shapes. Components in this directory must not
 * import orderbook-watch response types.
 */

import type { MasterExchangeRegionManifestResponse } from './master.types'

export const EXCHANGE_SEGMENTS = ['spot', 'linear_perp', 'inverse_perp'] as const

export type ExchangeSegment = (typeof EXCHANGE_SEGMENTS)[number]

/** Exact segment vocabulary: perpetual classes are never combined into a "perp" figure. */
export const EXCHANGE_SEGMENT_LABELS: Record<ExchangeSegment, string> = {
	spot: 'Spot',
	linear_perp: 'USD Perps',
	inverse_perp: 'COIN Perps'
}
export type ExchangeVenueKind = 'cex' | 'dex'
export type ExchangeRegionStatus = 'available' | 'restricted' | 'leaving' | 'unavailable'
export type ExchangeEuStatus = ExchangeRegionStatus
export type ExchangeMicaStatus = 'active' | 'in-progress'
export type ExchangeProfileMode = 'markets' | 'metadata-only'
export type MicaProduct = ExchangeSegment | 'margin' | 'futures' | 'options'

export type ExchangeEeaOrderbookOwnership =
	| { mode: 'own' }
	| { mode: 'shared' }
	| { mode: 'mixed'; sharedSegments: Array<ExchangeSegment>; dedicatedSegments: Array<ExchangeSegment> }

export interface ExchangeDoubleCountNote {
	volume?: string
	openInterest?: string
	depth?: string
}

/** One band of a depth ladder: cumulative USD on each side at ±`band` of mid, and
 *  whether the venue's book actually reached out that far (`coverage` = share of the
 *  segment's volume that did). Bands past the reach are forward-filled upstream, so
 *  a low coverage means "not measured", never "no liquidity". */
export interface ExchangeDepthBand {
	band: number
	bidUsd: number | null
	askUsd: number | null
	coverage: number
}

export type ExchangeDepthLadder = Array<ExchangeDepthBand>

export interface ExchangeSegmentActivity {
	marketCount: number
	coinCount: number | null
	volume24h: number | null
	volumePrevious24h: number | null
	openInterestUsd: number | null
	openInterestPreviousUsd: number | null
	depthBidUsd: number | null
	depthAskUsd: number | null
	depthPartial: boolean
	/** Cumulative depth across every band, for the depth-profile chart. `coverage`
	 *  marks which bands are measured rather than forward-filled at the fetch limit. */
	depthLadder: ExchangeDepthLadder | null
	volumeUpdatedAt: string | null
	doubleCount?: ExchangeDoubleCountNote
	supportsOpenInterest: boolean
	supportsDepth: boolean
}

export interface ExchangeNormalizedVolume {
	reported: number
	normalized: number
	/** Observed depth inside the volatility band — no extrapolated component. This is
	 *  the displayed figure: shown liquidity must be liquidity that exists. */
	activeLiquidity: number
	/** The extrapolated figure the normalized-volume cap was computed against. Kept
	 *  off screen; a venue must not be discounted for how far our snapshot reached,
	 *  but nor should that projection be presented as depth. */
	activeLiquidityForCap: number
	discountFraction: number
	unverifiedFraction: number
	flag: string | null
}

export interface ExchangeRelatedEntity {
	slug: string
	name: string
	profileHref: string
}

export interface ExchangeRelatedEntities {
	euEntity: ExchangeRelatedEntity | null
	globalEntity: ExchangeRelatedEntity | null
}

export interface ExchangeParentEntity {
	slug: string
	name: string
}

/**
 * Per-segment order-book ownership: the venue either runs its own book or
 * trades on a source venue's book. A shared relation is either a 'full' mirror
 * of the source's entire book or a 'subset' slice tracked under the venue's
 * own storage (metrics differ from the source's but stay doublecounted).
 */
export type ExchangeLiquidityRelation =
	| { mode: 'own' }
	| { mode: 'shared'; coverage: 'full' | 'subset'; source: { slug: string; name: string } }

export type ExchangeLiquidityBySegment = Record<ExchangeSegment, ExchangeLiquidityRelation | null>

export interface ExchangeFiatFeeRow {
	currency: string
	fee: string
	method: string
	minimum: string
	note: string
	source: ExchangeMetadataLink
	processingTime: string
}

export interface ExchangeFiatFees {
	onRamp: Array<ExchangeFiatFeeRow>
	offRamp: Array<ExchangeFiatFeeRow>
}

export interface ExchangeDirectoryRowModel {
	slug: string
	name: string
	kind: ExchangeVenueKind
	tracked: boolean
	/** Backend-authored total across spot, linear perps, and inverse perps. */
	totalVolume24h: number | null
	profileHref: string
	/** External DefiLlama protocol profile for venues tracked as protocols (dexs). */
	secondaryUrl: string | null
	/** Deep link to the venue's own Reserves tab when DefiLlama tracks its cex wallets. */
	reservesHref: string | null
	websiteUrl: string | null
	referralUrl: string | null
	related: ExchangeRelatedEntities
	parent: ExchangeParentEntity | null
	liquidity: ExchangeLiquidityBySegment
	segments: Partial<Record<ExchangeSegment, ExchangeSegmentActivity>>
	sparks: Partial<Record<ExchangeSegment, Array<number>>>
	reserves: {
		totalUsd: number | null
		cleanUsd: number | null
		ownTokenFraction: number | null
		inflows24hUsd: number | null
		inflows7dUsd: number | null
		inflows1mUsd: number | null
		auditor: string | null
		sourceUrl: string | null
	} | null
	fees: {
		spot: { maker: number | null; taker: number | null } | null
		linearPerp: { maker: number | null; taker: number | null } | null
		inversePerp: { maker: number | null; taker: number | null } | null
		feeToken: { symbol: string; discountFraction: number | null } | null
	} | null
	compliance: {
		headquarters: string | null
		euStatus: ExchangeEuStatus | null
		eeaOrderbookOwnership: ExchangeEeaOrderbookOwnership | null
		mica: {
			status: ExchangeMicaStatus
			licensed: boolean | null
			memberState: string | null
			regulator: string | null
		} | null
		licenseCount: number | null
		kyc: { required: boolean; short: string | null; summary: string | null } | null
	} | null
	profile: {
		founded: number | null
		nativeToken: string | null
	} | null
	funding: {
		fiatCurrencies: Array<string> | null
		fiatFees: ExchangeFiatFees | null
		hasFiatOnramp: boolean | null
		rampCost: MicaVenueModel['rampCost']
	} | null
	warnings: Array<{ level: 'info' | 'caution' | 'danger'; text: string; expiry?: string }>
	regional: Pick<MasterExchangeRegionManifestResponse, 'variants'> | null
	selectedCountry: string | null
	selectedCountryStatus: ExchangeRegionStatus | null
	normalizedVolume: Record<ExchangeSegment, ExchangeNormalizedVolume | null> | null
	/** Measured execution quality on the shared perp basket (USD perps only today):
	 * tick-level fills, not venue claims. Null for uncovered venues — never zero. */
	execution: {
		/** Assets behind the fill-quality figures (slippage, markout). */
		assets: Array<string>
		/** Assets behind cost to trade, which is published on a narrower set. */
		costAssets: Array<string>
		hoursCovered: number
		costToTradeBps: number | null
		/** The spread half of cost to trade, shown beside it. */
		effectiveSpreadBps: number | null
		realizedSlippage10kBps: number | null
		predictedSlippage10kBps: number | null
		realizedSlippage100kBps: number | null
		predictedSlippage100kBps: number | null
		markout1mBps: number | null
		markout5mBps: number | null
	} | null
	/** Internal quality rank — rendered as the tier chip + within-kind position beside
	 * the venue name, and the directory's default sort. `components` is the breakdown,
	 * kept for a later "why this rank" surface. */
	quality: {
		score: number
		rank: number
		/** Public tier band (S–D). */
		tier: string
		segments: Partial<Record<ExchangeSegment, number>>
		components: Record<string, number | null>
	} | null
}

/**
 * One venue's measured BTC execution quality plus fee, restricted to the BTC pair
 * specifically (not the shared basket median `ExchangeDirectoryRowModel.execution`
 * mixes several assets into) — for the cross-venue BTC comparison table on the
 * research charts page. Null fields mean not measured for this venue, never zero.
 */
export interface BtcExecutionRowModel {
	exchange: string
	name: string
	profileHref: string
	tier: string | null
	rank: number | null
	costToTradeBps: number | null
	effectiveSpreadBps: number | null
	quotedSpreadBps: number | null
	realizedSlippage10kBps: number | null
	realizedSlippage100kBps: number | null
	predictedSlippage10kBps: number | null
	predictedSlippage100kBps: number | null
	markout1sBps: number | null
	markout15sBps: number | null
	markout1mBps: number | null
	markout5mBps: number | null
	takerFeeBps: number | null
	hoursCovered: number
	nTrades: number
}

export interface ExchangeVolumeSplit {
	spot: number | null
	linearPerp: number | null
	inversePerp: number | null
	/** Backend-authored spot + linear + inverse grand total; never recomputed client-side. */
	total: number | null
}

export interface ExchangeDirectorySummaryModel {
	venueCount: number
	trackedVenueCount: number
	/** Backend total_trading_volume_24h — the only allowed cross-segment volume figure. */
	totalVolume24h: number | null
	spotVolume24h: number | null
	linearPerpVolume24h: number | null
	inversePerpVolume24h: number | null
	linearPerpOpenInterestUsd: number | null
	inversePerpOpenInterestUsd: number | null
	reservesUsd: number | null
	volumeByKind: Record<ExchangeVenueKind, ExchangeVolumeSplit>
}

export interface ExchangeDirectoryModel {
	rows: Array<ExchangeDirectoryRowModel>
	summary: ExchangeDirectorySummaryModel
	updatedAt: string
	executionAvailable: boolean
	/** The assets every measured venue covers. The published columns narrow further,
	 *  per metric, so each stays comparable across rows. Empty when no shared asset
	 *  exists and each row discloses its own basket instead. */
	executionBasket: Array<string>
	/** Assets behind the cost-to-trade column. */
	executionCostBasket: Array<string>
	/** Assets behind the slippage and markout columns. */
	executionFillBasket: Array<string>
}

export interface ExchangePairModel {
	pairUrl: string
	/** Exact producer pair ID, used when joining pair-specific measurements. */
	pairId: string
	symbol: string
	base: string
	quote: string
	baseGeckoId: string | null
	quoteGeckoId: string | null
	price: number | null
	markPrice: number | null
	indexPrice: number | null
	basis: number | null
	priceChange24h: number | null
	volume24h: number | null
	volumeChange24h: number | null
	openInterestUsd: number | null
	openInterestChange24h: number | null
	fundingRate8h: number | null
	fundingPeriodHours: number | null
	nextFundingAt: number | null
	maxLeverage: number | null
	makerFee: number | null
	takerFee: number | null
	listedAt: number | null
	volumeUpdatedAt: string | null
	spreadFraction: number | null
	depthBid2Usd: number | null
	depthAsk2Usd: number | null
	depthBidMaxDistance: number | null
	depthAskMaxDistance: number | null
	normalizedVolume: {
		reported: number
		normalized: number
		activeLiquidity: number
		discountFraction: number
		/** The ±band volatility picked for this pair (fraction of mid). */
		band: number
		/** Active liquidity as a share of the pair's whole captured book, 0–1. Null
		 *  when there is no book to compare against. Exactly 1 means the volatility
		 *  band reached at least as far as our snapshot did, so the band figure IS
		 *  the whole visible book. */
		activeLiquidityShare: number | null
		status: string
	} | null
	/** Cumulative depth per band for this pair — summed across a segment's pairs to
	 *  draw the venue's book profile. */
	depthLadder: ExchangeDepthLadder | null
}

export interface ExchangeProfileSegmentModel {
	segment: ExchangeSegment
	marketCount: number
	volume24h: number | null
	volumePrevious24h: number | null
	openInterestUsd: number | null
	openInterestPreviousUsd: number | null
	depth2Usd: number | null
	capabilities: {
		openInterest: boolean
		funding: boolean
		depth: boolean
	}
	pairs: Array<ExchangePairModel>
}

export type ExchangeMetadataScalarFormat = 'text' | 'number' | 'usd' | 'pct' | 'date' | 'bool' | 'link'

export type ExchangeMetadataTone = 'positive' | 'caution' | 'negative' | 'neutral'
export type ExchangeMetadataGroupKey =
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

export interface ExchangeMetadataSource {
	url: string
	asOf?: string
	note?: string
}

export interface ExchangeMetadataLink {
	label: string
	url: string
}

export type ExchangeMetadataCell = string | number | boolean | Array<string> | ExchangeMetadataLink | null

interface ExchangeMetadataFieldBase {
	key: string
	label: string
	source?: ExchangeMetadataSource
	comparable: boolean
}

export interface ExchangeMetadataTableColumn {
	key: string
	label: string
	format?: ExchangeMetadataScalarFormat
	align?: 'left' | 'right'
}

type ExchangeMetadataNonTableFieldModel = ExchangeMetadataFieldBase &
	(
		| { type: 'text' | 'date'; value: string }
		| { type: 'number' | 'usd' | 'pct'; value: number }
		| { type: 'bool'; value: boolean }
		| { type: 'badge'; value: string; tone?: ExchangeMetadataTone }
		| { type: 'pills'; value: Array<string> }
		| { type: 'link'; value: ExchangeMetadataLink }
		| { type: 'links'; value: Array<ExchangeMetadataLink> }
		| { type: 'kv'; value: Array<{ label: string; value: ExchangeMetadataCell }> }
	)

export type ExchangeMetadataFieldModel =
	| ExchangeMetadataNonTableFieldModel
	| (ExchangeMetadataFieldBase & {
			type: 'table'
			value: Array<Record<string, ExchangeMetadataCell>>
			columns: Array<ExchangeMetadataTableColumn>
	  })

export type ExchangeMetadataKpiModel = ExchangeMetadataNonTableFieldModel

export interface ExchangeMetadataGroupModel {
	key: ExchangeMetadataGroupKey
	title: string
	fromProofOfReserves?: boolean
	fields: Array<ExchangeMetadataFieldModel>
	source?: ExchangeMetadataSource
}

export interface ExchangePromotionModel {
	label: string
	title: string
	subtitle: string | null
	url: string | null
	termsUrl: string | null
	startsAt: string | null
	endsAt: string | null
	priority: number | null
	sourceUrl: string
}

export interface ExchangeReservesModel {
	/** DefiLlama protocol slug powering the reserve charts, e.g. "binance-cex". */
	protocolSlug: string
	ownToken: string | null
}

export interface ExchangeNativeTokenModel {
	coinId: string | null
	name: string
	symbol: string
	url: string
	priceUsd: number | null
	change24h: number | null
}

export interface ExchangeHackModel {
	date: number | null
	name: string
	amountUsd: number | null
	technique: string | null
	returnedFundsUsd: number | null
}

export interface ExchangeRaiseModel {
	date: number
	round: string | null
	amountUsd: number | null
	valuationUsd: number | null
	investors: Array<string>
	sourceUrl: string | null
}

export interface ExchangeExecutionPairModel {
	asset: string
	hoursCovered: number
	fillCount: number
	costToTradeBps: number | null
	effectiveSpreadBps: number | null
	quotedSpreadBps: number | null
	realizedSlippage10kBps: number | null
	predictedSlippage10kBps: number | null
	realizedSlippage100kBps: number | null
	predictedSlippage100kBps: number | null
	realizedSlippage1mBps: number | null
	predictedSlippage1mBps: number | null
	markout1sBps: number | null
	markout15sBps: number | null
	markout1mBps: number | null
	markout5mBps: number | null
}

export interface ExchangeExecutionFeedHealth {
	date: string
	avgGapMs: number
	p99GapMs: number
	maxGapMs: number
	downtimeS: number
	degraded: boolean
}

/** Measured execution quality for the profile's Execution tab: tick-level fills on
 * the shared perp basket (USD perps only today). Null = venue not covered. */
export interface ExchangeExecutionModel {
	assets: Array<string>
	hoursCovered: number
	costToTradeBps: number | null
	realizedSlippage10kBps: number | null
	predictedSlippage10kBps: number | null
	markout1mBps: number | null
	feed: ExchangeExecutionFeedHealth | null
	pairs: Array<ExchangeExecutionPairModel>
}

/** The venue's quality ranking, joined with the published methodology catalog so the
 * breakdown can name each pillar and its weight. */
/** One pillar of the published ranking catalog, as the ranking page lists it. */
export interface ExchangeRankingPillarModel {
	key: string
	label: string
	weight: number
	what: string
	/** What an absence means — always "not measured", never "measured as bad". */
	na: string
}

export interface ExchangeRankingSubModel {
	key: string
	label: string
	weight: number
	what: string
}

/** One ranked venue on the ranking page: score, tier, positions and the pillar
 * breakdown, plus the sub-scores the profile page also shows. */
export interface ExchangeRankingRowModel {
	slug: string
	name: string
	kind: ExchangeVenueKind
	profileHref: string
	score: number
	tier: string
	rankInKind: number
	overallRank: number
	components: Record<string, number | null>
	execSubs: Record<string, number | null> | null
	execDelivery: number | null
	reserveSubs: Record<string, number | null> | null
}

/** The cross-venue ranking page: every scored venue in score order plus the catalog
 * that explains the pillars. Built only when the ranks file and the catalog describe
 * the same computation (matching generated_at). */
export interface ExchangeRankingModel {
	generatedAt: string
	pillars: Array<ExchangeRankingPillarModel>
	execSubs: Array<ExchangeRankingSubModel>
	reserveSubs: Array<ExchangeRankingSubModel>
	rows: Array<ExchangeRankingRowModel>
	insufficient: Array<{ slug: string; name: string; kind: ExchangeVenueKind; profileHref: string }>
}

export interface ExchangeProfileQualityModel {
	score: number
	tier: string
	/** Position within the venue's own kind (CEX or DEX). */
	rankInKind: number
	/** Position across ALL ranked venues, by score. */
	overallRank: number
	overallTotal: number
	generatedAt: string
	components: Array<{
		key: string
		label: string
		weight: number
		score: number | null
		what: string
		na: string
	}>
	/** Sub-scores behind the Execution pillar (markout/cost/slip), joined with their
	 * published catalog. Empty when the venue has no measured execution. */
	execSubs: Array<{
		key: string
		label: string
		weight: number
		score: number | null
		what: string
	}>
}

export interface ExchangeProfileModel {
	slug: string
	name: string
	kind: ExchangeVenueKind
	profileMode: ExchangeProfileMode
	execution: ExchangeExecutionModel | null
	quality: ExchangeProfileQualityModel | null
	defillamaUrl: string | null
	/** DefiLlama cex slug from the venue's links; input for reserve gating, not yet validated against protocol metadata. */
	defillamaCexSlug: string | null
	nativeToken: ExchangeNativeTokenModel | null
	hacks: Array<ExchangeHackModel>
	raises: Array<ExchangeRaiseModel>
	/** Reserve-chart availability, resolved against the protocol metadata cache at build time. */
	reserves: ExchangeReservesModel | null
	segments: Partial<Record<ExchangeSegment, ExchangeProfileSegmentModel>>
	metadata: {
		website: string | null
		referralUrl: string | null
		twitterUrl: string | null
		promotions: Array<ExchangePromotionModel>
		kpis: Array<ExchangeMetadataKpiModel>
		groups: Array<ExchangeMetadataGroupModel>
	}
}

export interface ExchangeCountryAvailabilityModel {
	country: string
	region: { key: string; label: string }
	availability: ExchangeRegionStatus
	segments: Array<ExchangeSegment>
	note: string | null
	source: ExchangeMetadataSource | null
	usedFallback: boolean
}

export type ExchangeRegionalMetadataModel =
	| (ExchangeCountryAvailabilityModel & { availability: 'unavailable'; segments: [] })
	| {
			[Status in Exclude<ExchangeRegionStatus, 'unavailable'>]: ExchangeCountryAvailabilityModel & {
				availability: Status
				metadata: ExchangeProfileModel['metadata']
			}
	  }[Exclude<ExchangeRegionStatus, 'unavailable'>]

/** Directory overview chart: full-history columnar series keyed by cex/dex/total × spot/linear_perp/inverse_perp volume and OI. */
export interface ExchangeOverviewChartModel {
	days: Array<number>
	lastUpdated: string
	series: Record<string, Array<number | null>>
}

export interface ExchangeResearchChartModel {
	metric: ExchangeResearchMetric
	segment: ExchangeResearchSegmentMode
	grouping: ExchangeResearchGrouping
	title: string
	description: string
	days: Array<number>
	lines: Array<{ id: string; label: string; values: Array<number | null> }>
	valueSymbol: '$' | '%'
	builtAt: string | null
}

export type ExchangeResearchMetric = 'volume' | 'open-interest' | 'depth' | 'normalized-volume' | 'survival-ratio'
/** 'separate' means each chart line carries exactly one segment; segments are never summed. */
export type ExchangeResearchSegmentMode = ExchangeSegment | 'separate'
export type ExchangeResearchGrouping = 'exchange' | 'venue-type' | 'segment'

export type ExchangeResearchView =
	| 'spot-exchanges'
	| 'linear-perp-exchanges'
	| 'inverse-perp-exchanges'
	| 'volume-types'
	| 'open-interest-btc-vs-alt'
	| 'open-interest-linear-exchanges'
	| 'open-interest-inverse-exchanges'
	| 'open-interest-types'
	| 'normalized-spot-exchanges'
	| 'normalized-linear-exchanges'
	| 'normalized-inverse-exchanges'
	| 'normalized-types'
	| 'normalized-segments'
	| 'survival-spot-exchanges'
	| 'survival-linear-exchanges'
	| 'survival-inverse-exchanges'
	| 'depth-spot-exchanges'
	| 'depth-linear-exchanges'
	| 'depth-inverse-exchanges'
	| 'depth-types'
	| 'btc-depth'

export interface ExchangeResearchReportModel {
	views: Array<{
		id: ExchangeResearchView
		label: string
		chart: ExchangeResearchChartModel
	}>
}

export interface MicaVenueModel {
	exchange: string
	name: string
	profileHref: string
	website: string | null
	referralUrl: string | null
	promotions: Array<ExchangePromotionModel>
	micaStatus: ExchangeMicaStatus | null
	micaLicensed: boolean
	micaMemberState: string | null
	micaRegulator: string | null
	licenseCount: number | null
	products: Array<MicaProduct>
	marketCount: number | null
	spotFee: { maker: number | null; taker: number | null } | null
	perpFee: { maker: number | null; taker: number | null } | null
	depth: {
		spotPartialCoverage: boolean
		perpPartialCoverage: boolean
		spotBid05Usd: number | null
		spotAsk05Usd: number | null
		spotBid2Usd: number | null
		spotAsk2Usd: number | null
		perpBid05Usd: number | null
		perpAsk05Usd: number | null
		perpBid2Usd: number | null
		perpAsk2Usd: number | null
	}
	kyc: { required: boolean; short: string | null; summary: string | null } | null
	fiatOnramp: boolean
	rampCost: {
		notionalUsd: number
		pair: string | null
		onRamp: {
			fiatFeeUsd: number | null
			tradeFeeUsd: number | null
			slippageUsd: number | null
			transferFeeUsd: number | null
			totalUsd: number | null
			totalFraction: number | null
		}
		offRamp: {
			fiatFeeUsd: number | null
			tradeFeeUsd: number | null
			slippageUsd: number | null
			transferFeeUsd: number | null
			totalUsd: number | null
			totalFraction: number | null
		}
		assumptions: {
			method: string
			takerFee: number | null
			halfSpreadFraction: number | null
			btcWithdrawalFeeBtc: number | null
			btcNetworkFeeBtc: number | null
			btcPriceUsd: number | null
		}
	} | null
}

export interface MicaVenueRowModel extends MicaVenueModel {
	activePromotion: ExchangePromotionModel | null
}

// --- /ramp: fiat on/off-ramp cost -------------------------------------------
// Country resolution stays client-side (the country is URL state), so a venue
// carries every region variant the producer published and the table picks one.

export interface RampLegModel {
	fiatFeeUsd: number | null
	tradeFeeUsd: number | null
	slippageUsd: number | null
	transferFeeUsd: number | null
	/** Null unless every leg above is known — a missing leg is never treated as zero. */
	totalUsd: number | null
	totalFraction: number | null
}

/** Currency-independent baseline: execution plus the two BTC transfer legs. */
export interface RampTradeLegsModel {
	pair: string | null
	tradeFeeUsd: number | null
	slippageBuyUsd: number | null
}

export interface RampCurrencyCostModel {
	currency: string
	pair: string | null
	onRamp: RampLegModel
	offRamp: RampLegModel
	/** The rail actually priced for this currency and size, e.g. 'SEPA Instant'. */
	onRail: string | null
	offRail: string | null
}

export interface RampAssumptionsModel {
	takerFee: number | null
	btcWithdrawalFeeBtc: number | null
	btcNetworkFeeBtc: number | null
}

export interface CryptoRailRowModel {
	asset: string
	network: string
	fee: string
	minimum: string
	note: string
	processingTime: string
	source: ExchangeMetadataLink
}

export interface CryptoRailsModel {
	deposit: Array<CryptoRailRowModel>
	withdraw: Array<CryptoRailRowModel>
}

export interface RampVariantModel {
	region: string
	status: ExchangeRegionStatus
	note: string | null
	countryOverrides: Partial<Record<string, { status: ExchangeRegionStatus; note: string | null }>>
	fiatCurrencies: Array<string>
	rails: ExchangeFiatFees | null
	cryptoRails: CryptoRailsModel | null
	kyc: { required: boolean; short: string | null; summary: string | null } | null
	regulator: string | null
	micaLicensed: boolean | null
	/** Keyed by notional in USD, as a string. */
	trade: Partial<Record<string, RampTradeLegsModel>>
	/** currency → notional → both directions. Only currencies with a usable rail. */
	cost: Partial<Record<string, Partial<Record<string, RampCurrencyCostModel>>>>
	assumptions: RampAssumptionsModel
}

export interface RampVenueModel {
	exchange: string
	name: string
	profileHref: string
	website: string | null
	referralUrl: string | null
	/** Keyed by region; `global` is always present and is the fallback. */
	variants: Partial<Record<string, RampVariantModel>>
}

export interface RampCatalogModel {
	sizes: Array<number>
	btcNetworkFeeBtc: number | null
	venues: Array<RampVenueModel>
}

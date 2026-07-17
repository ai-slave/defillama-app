/**
 * Backend-neutral read models for the Exchanges product surfaces.
 *
 * Transport modules own upstream DTOs and are responsible for mapping one
 * active contract into these shapes. Components in this directory must not
 * import orderbook-watch response types.
 */

export const EXCHANGE_SEGMENTS = ['spot', 'linear_perp', 'inverse_perp'] as const

export type ExchangeSegment = (typeof EXCHANGE_SEGMENTS)[number]

/** Exact segment vocabulary: perpetual classes are never combined into a "perp" figure. */
export const EXCHANGE_SEGMENT_LABELS: Record<ExchangeSegment, string> = {
	spot: 'Spot',
	linear_perp: 'Linear Perps',
	inverse_perp: 'Inverse Perps'
}
export type ExchangeVenueKind = 'cex' | 'dex'
export type ExchangeEuStatus = 'available' | 'restricted' | 'leaving' | 'unavailable'
export type ExchangeMicaStatus = 'active' | 'in-progress'
export type ExchangeProfileMode = 'markets' | 'metadata-only'
export type MicaProduct = ExchangeSegment | 'margin' | 'futures' | 'options'

export type ExchangeEeaOrderbookOwnership =
	| { mode: 'own' }
	| { mode: 'shared' }
	| { mode: 'mixed'; sharedSegments: ExchangeSegment[]; dedicatedSegments: ExchangeSegment[] }

export interface ExchangeDoubleCountNote {
	volume?: string
	openInterest?: string
	depth?: string
}

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
	volumeUpdatedAt: string | null
	doubleCount?: ExchangeDoubleCountNote
	supportsOpenInterest: boolean
	supportsDepth: boolean
}

export interface ExchangeNormalizedVolume {
	reported: number
	normalized: number
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
	onRamp: ExchangeFiatFeeRow[]
	offRamp: ExchangeFiatFeeRow[]
}

export interface ExchangeDirectoryRowModel {
	slug: string
	name: string
	kind: ExchangeVenueKind
	tracked: boolean
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
	sparks: Partial<Record<ExchangeSegment, number[]>>
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
		availableRegions: string[]
		restrictedRegions: string[]
	} | null
	profile: {
		founded: number | null
		nativeToken: string | null
	} | null
	funding: {
		fiatCurrencies: string[] | null
		fiatFees: ExchangeFiatFees | null
		hasFiatOnramp: boolean | null
		rampCost: MicaVenueModel['rampCost']
	} | null
	warnings: Array<{ level: 'info' | 'caution' | 'danger'; text: string; expiry?: string }>
	normalizedVolume: Record<ExchangeSegment, ExchangeNormalizedVolume | null> | null
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
	rows: ExchangeDirectoryRowModel[]
	summary: ExchangeDirectorySummaryModel
	updatedAt: string
}

export interface ExchangePairModel {
	pairUrl: string
	symbol: string
	base: string
	quote: string
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
		discountFraction: number
		status: string
	} | null
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
	pairs: ExchangePairModel[]
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

export type ExchangeMetadataCell = string | number | boolean | string[] | ExchangeMetadataLink | null

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
		| { type: 'pills'; value: string[] }
		| { type: 'link'; value: ExchangeMetadataLink }
		| { type: 'links'; value: ExchangeMetadataLink[] }
		| { type: 'kv'; value: Array<{ label: string; value: ExchangeMetadataCell }> }
	)

export type ExchangeMetadataFieldModel =
	| ExchangeMetadataNonTableFieldModel
	| (ExchangeMetadataFieldBase & {
			type: 'table'
			value: Array<Record<string, ExchangeMetadataCell>>
			columns: ExchangeMetadataTableColumn[]
	  })

export type ExchangeMetadataKpiModel = ExchangeMetadataNonTableFieldModel

export interface ExchangeMetadataGroupModel {
	key: ExchangeMetadataGroupKey
	title: string
	fromProofOfReserves?: boolean
	fields: ExchangeMetadataFieldModel[]
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
	hasStablecoins: boolean
	ownToken: string | null
}

export interface ExchangeProfileModel {
	slug: string
	name: string
	kind: ExchangeVenueKind
	profileMode: ExchangeProfileMode
	defillamaUrl: string | null
	/** DefiLlama cex slug from the venue's links; input for reserve gating, not yet validated against protocol metadata. */
	defillamaCexSlug: string | null
	/** Reserve-chart availability, resolved against the protocol metadata cache at build time. */
	reserves: ExchangeReservesModel | null
	segments: Partial<Record<ExchangeSegment, ExchangeProfileSegmentModel>>
	metadata: {
		website: string | null
		referralUrl: string | null
		promotions: ExchangePromotionModel[]
		kpis: ExchangeMetadataKpiModel[]
		groups: ExchangeMetadataGroupModel[]
	}
}

/** Directory overview chart: full-history columnar series keyed by cex/dex/total × spot/linear_perp/inverse_perp volume and OI. */
export interface ExchangeOverviewChartModel {
	days: number[]
	lastUpdated: string
	series: Record<string, Array<number | null>>
}

export interface ExchangeResearchChartModel {
	metric: ExchangeResearchMetric
	segment: ExchangeResearchSegmentMode
	grouping: ExchangeResearchGrouping
	title: string
	description: string
	days: number[]
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
	logoName: string
	profileHref: string
	website: string | null
	referralUrl: string | null
	promotions: ExchangePromotionModel[]
	micaStatus: ExchangeMicaStatus | null
	micaLicensed: boolean
	micaMemberState: string | null
	micaRegulator: string | null
	licenseCount: number | null
	products: MicaProduct[]
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

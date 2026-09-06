export const RWA_PERPS_VENUE_TYPES = ['DEX', 'CEX'] as const
export type RWAPerpsVenueType = (typeof RWA_PERPS_VENUE_TYPES)[number]

export interface IRWAPerpsMarket {
	id: string
	timestamp: number
	contract: string
	venue: string
	venueType: RWAPerpsVenueType
	openInterest: number
	openInterestChange24h: number | null
	volume24h: number
	volume24hChange24h: number | null
	price: number
	priceChange24h: number | null
	fundingRate: number
	premium: number
	cumulativeFunding: number
	referenceAsset: string | null
	referenceAssetGroup: string | null
	assetClass: Array<string> | null
	parentPlatform: string | null
	pair: string | null
	marginAsset: string | null
	settlementAsset: string | null
	category: Array<string> | null
	issuer: string | null
	website: Array<string> | null
	link: string | null
	oracleProvider: string | null
	description: string | null
	accessModel: string | null
	rwaClassification: string | null
	makerFeeRate: number
	takerFeeRate: number
	deployerFeeShare: number
	oraclePx: number
	midPx: number
	prevDayPx: number
	maxLeverage: number | null
	szDecimals: number
	fundingIntervalHours: number | null
	volume7d: number
	volume30d: number
	volumeAllTime: number
	estimatedProtocolFees24h: number
	estimatedProtocolFees7d: number
	estimatedProtocolFees30d: number
	estimatedProtocolFeesAllTime: number
	suspicious: boolean
}

export interface IRWAPerpsAggregateHistoricalPoint {
	timestamp: number
	id: string
	contract: string
	venue: string
	referenceAsset: string | null
	referenceAssetGroup: string | null
	assetClass: Array<string> | null
	category: Array<string>
	openInterest: number
	volume24h: number
	suspicious: boolean
}

export interface IRWAPerpsMarketChartPoint {
	timestamp: number
	openInterest: number
	volume24h: number
	price: number
	priceChange24h: number
	fundingRate: number
	premium: number
	cumulativeFunding: number
}

export interface IRWAPerpsListResponse {
	contracts: Array<string>
	venues: Array<string>
	categories: Array<string>
	assets: Array<string>
	assetGroups: Array<string>
	total: number
}

export interface IRWAPerpsStatsBucket {
	openInterest: number
	volume24h: number
	markets: number
}

export interface IRWAPerpsStatsResponse {
	totalMarkets: number
	totalOpenInterest: number
	totalVolume24h: number
	totalCumulativeFunding: number
	byVenue: Record<string, IRWAPerpsStatsBucket>
	byCategory: Record<string, IRWAPerpsStatsBucket>
	byAssetGroup: Record<string, IRWAPerpsStatsBucket>
	lastUpdated: string
}

export type IRWAPerpsBreakdownChartRow = { timestamp: number } & Record<string, number>
export type IRWAPerpsBreakdownChartResponse = Array<IRWAPerpsBreakdownChartRow>

export type IRWAPerpsIdMapResponse = Record<string, string>

export interface IRWAPerpsFundingHistoryWirePoint {
	timestamp: number
	id: string
	contract: string
	venue: string
	funding_rate: string
	premium: string
	open_interest: string
	funding_payment: string
	created_at: string
}

export interface IRWAPerpsFundingHistoryPoint {
	timestamp: number
	id: string
	contract: string
	venue: string
	fundingRate: number
	premium: number
	openInterest: number
	fundingPayment: number
	createdAt: string
}

export interface IRWAPerpsFundingHistoryParams {
	startTime?: number
	endTime?: number
}

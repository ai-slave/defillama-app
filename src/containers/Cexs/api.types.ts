interface RawCex {
	name: string
	slug?: string
	coin?: string | null
	coinSymbol?: string
	walletsLink?: string | null
	cgId?: string | null
	cgDeriv?: string
	cgSpotId?: string
	lastAuditDate?: number
	auditor?: string | null
	auditLink?: string
	url?: string
	ownTokens?: string[]
	currentTvl?: number
	cleanAssetsTvl?: number
	inflows_24h?: number
	inflows_1w?: number
	inflows_1m?: number
	spotVolume?: number
	oi?: number
	derivVolume?: number
	leverage?: number
}

export interface RawCexsResponse {
	cexs: RawCex[]
	cg_volume_cexs: string[]
}

export interface RawCexInflowsResponse {
	outflows?: number | null
}

export type CexAnalyticsView = 'summary' | 'comparison' | 'spot-vs-derivatives' | 'market-share'
export type CexAnalyticsMetric = 'spot' | 'derivatives'

export interface CexAnalyticsSnapshotRow {
	venue: string
	spotVolume24h: number
	derivativesVolume24h: number
	spotShare: number
	derivativesShare: number
	derivativesToSpotRatio: number | null
	openInterest: number | null
	avgLeverage: number | null
	cleanTvl: number | null
	volumeToTvl: number | null
}

export interface CexAnalyticsSummary {
	totalSpotVolume: number
	totalDerivativesVolume: number
	totalOpenInterest: number | null
	totalCleanTvl: number | null
	weightedAvgLeverage: number | null
	loadedAt: string | null
}

export interface CexAnalyticsSnapshotResponse {
	rows: CexAnalyticsSnapshotRow[]
	summary: CexAnalyticsSummary
}

export interface CexAnalyticsTotalsPoint {
	date: number
	spotVolume: number
	derivativesVolume: number
}

export interface CexAnalyticsMarketSharePoint {
	date: number
	venue: string
	share: number
}

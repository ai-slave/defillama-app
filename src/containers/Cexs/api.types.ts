export interface RawCex {
	name: string
	slug?: string
	coin?: string | null
	coinSymbol?: string | null
	walletsLink?: string | null
	cgId?: string | null
	cgDeriv?: string | null
	cgSpotId?: string | null
	lastAuditDate?: number
	auditor?: string | null
	auditLink?: string | null
	url?: string | null
	ownTokens?: Array<string> | null
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
	cexs: Array<RawCex>
	cg_volume_cexs: Array<string>
}

export interface RawCexInflowsTokenSnapshot {
	tvl: Record<string, number>
}

export interface RawCexInflowsResponse {
	outflows: number
	oldTokens: RawCexInflowsTokenSnapshot
	currentTokens: RawCexInflowsTokenSnapshot
}

export type RawCexInflowsBatchResponse = Partial<Record<string, RawCexInflowsResponse>>

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
	rows: Array<CexAnalyticsSnapshotRow>
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

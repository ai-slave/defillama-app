import type { IRWAPerpsMarket, IRWAPerpsMarketChartPoint } from './api.types'

interface IRWAPerpsContractInfo {
	contract: string
	displayName: string
	venue: string
	baseAsset: string | null
	baseAssetGroup: string | null
	assetClass: string | null
	rwaClassification: string | null
	accessModel: string | null
	parentPlatform: string | null
	issuer: string | null
	website: string | null
	link: string | null
	oracleProvider: string | null
	description: string | null
	categories: Array<string>
}

export interface IRWAPerpsContractFundingHistoryPoint {
	timestamp: number
	fundingRate: number
	premium: number
	openInterest: number
	fundingPayment: number
}

export interface IRWAPerpsContractData {
	contract: IRWAPerpsContractInfo
	market: IRWAPerpsMarket
	marketChart: Array<IRWAPerpsMarketChartPoint> | null
	fundingHistory: Array<IRWAPerpsContractFundingHistoryPoint> | null
}

export type RWAPerpsChartMetricKey = 'openInterest' | 'volume24h' | 'markets'
export type RWAPerpsOverviewBreakdown = 'venue' | 'assetClass' | 'assetGroup' | 'baseAsset' | 'contract'

export type RWAPerpsAllChartTarget = { kind: 'all' }
export type RWAPerpsVenueChartTarget = { kind: 'venue'; slug: string }
export type RWAPerpsAssetGroupChartTarget = { kind: 'assetGroup'; slug: string }
export type RWAPerpsAssetClassChartTarget = { kind: 'assetClass'; slug: string }
export type RWAPerpsExcludeAssetClassChartTarget = { kind: 'excludeAssetClass'; slug: string }
export type RWAPerpsBaseAssetChartTarget = { kind: 'baseAsset'; slug: string }

export type RWAPerpsChartTarget =
	| RWAPerpsAllChartTarget
	| RWAPerpsVenueChartTarget
	| RWAPerpsAssetGroupChartTarget
	| RWAPerpsAssetClassChartTarget
	| RWAPerpsExcludeAssetClassChartTarget

export type RWAPerpsMarketBreakdownTarget = RWAPerpsChartTarget | RWAPerpsBaseAssetChartTarget

interface IRWAPerpsChartScope<TTarget extends RWAPerpsMarketBreakdownTarget> {
	target: TTarget
	includeCex: boolean
}

export interface IRWAPerpsOverviewBreakdownRequest extends IRWAPerpsChartScope<RWAPerpsChartTarget> {
	key: RWAPerpsChartMetricKey
	breakdown: Exclude<RWAPerpsOverviewBreakdown, 'contract'>
}

export interface IRWAPerpsContractBreakdownRequest extends IRWAPerpsChartScope<RWAPerpsChartTarget> {
	key: RWAPerpsChartMetricKey
}

export interface IRWAPerpsMarketBreakdownRequest extends IRWAPerpsChartScope<RWAPerpsMarketBreakdownTarget> {
	key: RWAPerpsChartMetricKey
}

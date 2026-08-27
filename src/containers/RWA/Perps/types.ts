import type { RWAChartDataset } from '../chartDataset'
import type { IRWAPerpsMarket, IRWAPerpsMarketChartPoint } from './api.types'

export interface IRWAPerpsNavLink {
	label: string
	to: string
}

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
	categories: string[]
}

export interface IRWAPerpsContractFundingHistoryPoint {
	timestamp: number
	fundingRate: number
	premium: number
	openInterest: number
	fundingPayment: number
}

export type IRWAPerpsContractMarketChartPoint = IRWAPerpsMarketChartPoint

export interface IRWAPerpsContractData {
	contract: IRWAPerpsContractInfo
	market: IRWAPerpsMarket
	marketChart: IRWAPerpsContractMarketChartPoint[] | null
	fundingHistory: IRWAPerpsContractFundingHistoryPoint[] | null
}

export type RWAPerpsChartMetricKey = 'openInterest' | 'volume24h' | 'markets'
export type RWAPerpsChartView = 'timeSeries' | 'pie' | 'treemap' | 'hbar'
export type RWAPerpsTimeSeriesMode = 'grouped' | 'breakdown'
export type RWAPerpsTreemapNestedBy = 'none' | 'assetClass' | 'baseAsset' | 'contract'

export type RWAPerpsOverviewBreakdown = 'venue' | 'assetClass' | 'assetGroup' | 'baseAsset' | 'contract'
export type RWAPerpsOverviewTimeSeriesBreakdown = 'venue' | 'assetClass' | 'assetGroup' | 'baseAsset' | 'contract'
export type RWAPerpsOverviewNonTimeSeriesBreakdown = 'assetGroup' | 'venue' | 'assetClass' | 'baseAsset' | 'contract'
export type RWAPerpsOverviewTreemapBreakdown = 'venue' | 'assetClass' | 'baseAsset' | 'assetGroup' | 'contract'
export type RWAPerpsVenueBreakdown = 'assetGroup' | 'baseAsset' | 'contract' | 'assetClass'
export type RWAPerpsVenueTimeSeriesBreakdown = 'assetGroup' | 'baseAsset' | 'contract' | 'assetClass'
export type RWAPerpsVenueNonTimeSeriesBreakdown = 'assetGroup' | 'baseAsset' | 'contract' | 'assetClass'
export type RWAPerpsVenueTreemapBreakdown = 'assetClass' | 'baseAsset' | 'assetGroup' | 'contract'
export type RWAPerpsAssetGroupBreakdown = 'venue' | 'baseAsset' | 'contract' | 'assetClass'
export type RWAPerpsAssetGroupTimeSeriesBreakdown = 'venue' | 'baseAsset' | 'contract' | 'assetClass'
export type RWAPerpsAssetGroupNonTimeSeriesBreakdown = 'venue' | 'baseAsset' | 'contract' | 'assetClass'
export type RWAPerpsAssetGroupTreemapBreakdown = 'venue' | 'baseAsset' | 'assetClass' | 'contract'
export type RWAPerpsAssetTimeSeriesBreakdown = 'venue' | 'contract'
export type RWAPerpsAssetNonTimeSeriesBreakdown = 'venue' | 'contract'
export type RWAPerpsAssetTreemapBreakdown = 'venue' | 'contract'
export type RWAPerpsOverviewSnapshotBreakdown = RWAPerpsOverviewNonTimeSeriesBreakdown
export type RWAPerpsVenueSnapshotBreakdown = RWAPerpsVenueNonTimeSeriesBreakdown
export type RWAPerpsAssetGroupSnapshotBreakdown = RWAPerpsAssetGroupNonTimeSeriesBreakdown
export type RWAPerpsAssetSnapshotBreakdown = RWAPerpsAssetNonTimeSeriesBreakdown
export type RWAPerpsChartMode = 'overview' | 'venue' | 'assetGroup' | 'asset'

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

export interface IRWAPerpsOverviewPageData {
	markets: IRWAPerpsMarket[]
	initialChartDataset: RWAChartDataset
	totals: {
		openInterest: number
		openInterestChange24h: number | null
		volume24h: number
		volume24hChange24h: number | null
		markets: number
		protocolFees24h: number
		cumulativeFunding: number
	}
}

export interface IRWAPerpsVenuePageData {
	venue: string
	markets: IRWAPerpsMarket[]
	initialChartDataset: RWAChartDataset
	venueLinks: IRWAPerpsNavLink[]
	totals: {
		openInterest: number
		openInterestChange24h: number | null
		volume24h: number
		volume24hChange24h: number | null
		markets: number
		protocolFees24h: number
	}
}

export interface IRWAPerpsAssetGroupPageData {
	assetGroup: string
	markets: IRWAPerpsMarket[]
	initialChartDataset: RWAChartDataset
	assetGroupLinks: IRWAPerpsNavLink[]
	totals: {
		openInterest: number
		openInterestChange24h: number | null
		volume24h: number
		volume24hChange24h: number | null
		markets: number
		protocolFees24h: number
	}
}

export interface IRWAPerpsAssetPageData {
	asset: string
	markets: IRWAPerpsMarket[]
	initialChartDataset: RWAChartDataset
	assetLinks: IRWAPerpsNavLink[]
	totals: {
		openInterest: number
		openInterestChange24h: number | null
		volume24h: number
		volume24hChange24h: number | null
		markets: number
		protocolFees24h: number
	}
}

export interface IRWAPerpsVenuesOverviewRow {
	venue: string
	openInterest: number
	openInterestShare: number
	volume24h: number
	volume24hShare: number
	markets: number
}

export interface IRWAPerpsVenuesOverview {
	rows: IRWAPerpsVenuesOverviewRow[]
	dexRows: IRWAPerpsVenuesOverviewRow[]
	initialChartDataset: RWAChartDataset
}

export interface IRWAPerpsAssetGroupsOverviewRow {
	assetGroup: string
	openInterest: number
	openInterestShare: number
	volume24h: number
	volume24hShare: number
	markets: number
}

export interface IRWAPerpsAssetGroupsOverview {
	rows: IRWAPerpsAssetGroupsOverviewRow[]
	dexRows: IRWAPerpsAssetGroupsOverviewRow[]
	initialChartDataset: RWAChartDataset
}

export interface IRWAPerpsAssetsOverviewRow {
	asset: string
	assetGroups: string[]
	openInterest: number
	volume24h: number
	markets: number
	venues: number
	dexVenues: number
	cexVenues: number
	fundingRateMin: number
	fundingRateMax: number
}

export interface IRWAPerpsAssetsOverview {
	rows: IRWAPerpsAssetsOverviewRow[]
	dexRows: IRWAPerpsAssetsOverviewRow[]
	initialChartDataset: RWAChartDataset | null
}

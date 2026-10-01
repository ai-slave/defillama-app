import type { LlamaConfigResponse } from '~/api/types'
import type { IChainMetadata } from '~/utils/metadata/types'
import type {
	StablecoinBridgeInfoResponse,
	StablecoinChartPoint,
	StablecoinDetailResponse,
	StablecoinDominanceResponse,
	StablecoinListAsset,
	StablecoinPegBalances,
	StablecoinsListResponse
} from './api.types'
import type { StablecoinChartSeriesPayload } from './chartSeries'
import type { FormattedStablecoinAsset, IFormattedStablecoinChainRow, StablecoinMcapPoint } from './utils'

export type StablecoinOverviewChartPoint = {
	date: number
	mcap: StablecoinPegBalances
}

export interface StablecoinsGlobalDataCache {
	chainList: Array<string>
	chains: Array<string>
}

export interface StablecoinOverviewChartInputs {
	chartDataByPeggedAsset: Array<Array<StablecoinOverviewChartPoint>>
	peggedAssetNames: Array<string>
	peggedAssetIdToChartDataIndex: Record<string, number>
	doublecountedIds: Array<number>
}

export interface PeggedOverviewPageData {
	chains: Array<string>
	filteredPeggedAssets: Array<FormattedStablecoinAsset>
	chain: string
	defaultChartData: StablecoinChartSeriesPayload
}

export interface PeggedChainsPageData {
	chainCirculatings: Array<IFormattedStablecoinChainRow>
	chainList: Array<string>
	chainsGroupbyParent: Record<string, Record<string, Array<string>>>
	deprecatedChains: Record<string, true>
	change1d: string | null
	change7d: string | null
	change30d: string | null
	totalMcapCurrent: number | null
	change1d_nol: string | null
	change7d_nol: string | null
	change30d_nol: string | null
	dataTimestamp: number | null
	isDataStale: boolean
}

export interface StablecoinChainsPageInput {
	peggedAssets: Array<StablecoinListAsset>
	chains: PeggedAssetsInput['chains']
	chainCoingeckoIds: LlamaConfigResponse['chainCoingeckoIds']
	aggregatedChart: Array<StablecoinMcapPoint>
	dominanceMap: StablecoinDominanceResponse['dominanceMap']
	chainChartMap: StablecoinDominanceResponse['chainChartMap']
}

export interface StablecoinChainsChartInput {
	chains: PeggedAssetsInput['chains']
	chainChartMap: StablecoinDominanceResponse['chainChartMap']
}

export interface StablecoinChainsPageSummaryOptions {
	chainMetadata: Record<string, IChainMetadata>
	currentTimeMs: number
}

export interface StablecoinChainsChartSource {
	chainList: Array<string>
	chartDataByChain: Array<Array<{ date: number; mcap: number | null }> | null>
}

export interface StablecoinBridgeAmount {
	amount: number
	sourceChain: string | null
}

export type StablecoinBridges = Record<string, Array<StablecoinBridgeAmount>> | null

export interface PeggedAssetPageProps {
	chainsUnique: Array<string>
	chainCirculatings: Array<{
		circulating: number | null
		unreleased: number | null
		change_1d: number | null
		change_7d: number | null
		change_1m: number | null
		circulatingPrevDay: number | null
		circulatingPrevWeek: number | null
		circulatingPrevMonth: number | null
		bridgedAmount: number | null
		bridges: StablecoinBridges
		name: string
		symbol: string
	}>
	peggedAssetData: Omit<StablecoinDetailResponse, 'chainBalances' | 'currentChainBalances' | 'tokens'>
	defaultChartData: StablecoinChartSeriesPayload
	totalCirculating: number | null
	unreleased: number | null
	mcap: number | null
	bridgeInfo: StablecoinBridgeInfoResponse
	blockExplorerUrl: string | null
	blockExplorerName: string | null
}

export interface PeggedChainMcapSummary {
	mcap: number | null
	change7dUsd: number | null
	change7d: string | null
	topToken: { symbol: string; mcap: number }
	dominance: string | null
	mcapChartData: Array<[number, number]> | null
}

export type PeggedAssetsInput = Pick<StablecoinsListResponse, 'peggedAssets' | 'chains'>

export type PeggedAssetsForChartInput = {
	peggedAssets: Array<StablecoinListAsset>
	breakdown: Record<string, Array<StablecoinChartPoint>>
	doublecountedSourceIds: Array<string>
}

export interface RawChainAssetCategory {
	total: string
	breakdown: Record<string, string>
}

export interface RawChainAsset {
	canonical: RawChainAssetCategory
	ownTokens?: RawChainAssetCategory
	native?: RawChainAssetCategory
	thirdParty: RawChainAssetCategory
	total: RawChainAssetCategory
}

export type RawChainsAssetsResponse = Record<string, RawChainAsset | number> & { timestamp: number }

export interface ChainAssetCategory {
	total: number
	breakdown: Record<string, number>
}

export interface ChainAsset {
	canonical: ChainAssetCategory
	ownTokens?: ChainAssetCategory
	native?: ChainAssetCategory
	thirdParty: ChainAssetCategory
	total: ChainAssetCategory
}

export type ChainsAssetsResponse = Record<string, ChainAsset>

export interface ChainAssetTotals {
	total: { total: number }
	canonical: { total: number }
	thirdParty: { total: number }
	native?: { total: number }
	ownTokens?: { total: number }
}

export type ChainsAssetTotalsResponse = Record<string, ChainAssetTotals>

export const CHAIN_ASSET_FLOW_CATEGORIES = [
	'total',
	'canonical',
	'native',
	'ownTokens',
	'thirdParty',
	'stablecoins',
	'rwa',
	'lst'
] as const

export type ChainAssetFlowCategory = (typeof CHAIN_ASSET_FLOW_CATEGORIES)[number]

export interface RawChainAssetFlowValue {
	perc: string
	raw: string
}

export type RawChainAssetsFlowEntry = Partial<Record<ChainAssetFlowCategory, RawChainAssetFlowValue>>
export type RawChainAssetsFlows1dResponse = Record<string, RawChainAssetsFlowEntry>

export interface ChainAssetFlowValue {
	perc: number
	raw: number
}

export type ChainAssetsFlowEntry = Partial<Record<ChainAssetFlowCategory, ChainAssetFlowValue>>
export type ChainsAssetsFlows1dResponse = Record<string, ChainAssetsFlowEntry>

/** Precomputed `/chain-assets/chart/:chain` wire contract. Timestamps remain Unix seconds. */
export interface RawChainAssetsChartDataPoint {
	timestamp: number
	data: Record<string, string> & {
		total: string
		ownTokens?: string
	}
}

export type RawChainAssetsChartResponse = RawChainAssetsChartDataPoint[]

export interface ChainAssetsChartDataPoint {
	timestamp: number
	data: Record<string, number> & {
		total: number
		ownTokens?: number
	}
}

export type ChainAssetsChartResponse = ChainAssetsChartDataPoint[]

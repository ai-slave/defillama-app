export interface RawChainAssetCategory {
	total: string
	breakdown: Record<string, string>
}

/**
 * Sections the producer may omit. `native`/`ownTokens` predate the eight-section split; the v2
 * producer carves `stablecoins`/`rwa`/`lst` back out of canonical/thirdParty/native, so a payload
 * carries either five sections or eight and both have to normalize.
 */
export const CHAIN_ASSET_OPTIONAL_CATEGORIES = ['native', 'ownTokens', 'stablecoins', 'rwa', 'lst'] as const

export type ChainAssetOptionalCategory = (typeof CHAIN_ASSET_OPTIONAL_CATEGORIES)[number]

export const CHAIN_ASSET_CATEGORIES = ['total', 'canonical', 'thirdParty', ...CHAIN_ASSET_OPTIONAL_CATEGORIES] as const

export type ChainAssetCategoryKey = (typeof CHAIN_ASSET_CATEGORIES)[number]

export type RawChainAsset = {
	canonical: RawChainAssetCategory
	thirdParty: RawChainAssetCategory
	total: RawChainAssetCategory
} & Partial<Record<ChainAssetOptionalCategory, RawChainAssetCategory>>

export type RawChainsAssetsResponse = Record<string, RawChainAsset | number> & { timestamp: number }

export interface ChainAssetCategory {
	total: number
	breakdown: Record<string, number>
}

export type ChainAsset = {
	canonical: ChainAssetCategory
	thirdParty: ChainAssetCategory
	total: ChainAssetCategory
} & Partial<Record<ChainAssetOptionalCategory, ChainAssetCategory>>

export type ChainAssetTotals = {
	total: { total: number }
	canonical: { total: number }
	thirdParty: { total: number }
} & Partial<Record<ChainAssetOptionalCategory, { total: number }>>

export type ChainsAssetTotalsResponse = Record<string, ChainAssetTotals>

export interface ChainAssetsDetailResponse {
	chainData: ChainAsset | null
	totals: ChainsAssetTotalsResponse
}

export const CHAIN_ASSET_FLOW_CATEGORIES = CHAIN_ASSET_CATEGORIES

export type ChainAssetFlowCategory = ChainAssetCategoryKey

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
	data: { total: string } & Partial<Record<Exclude<ChainAssetCategoryKey, 'total'>, string>>
}

export type RawChainAssetsChartResponse = Array<RawChainAssetsChartDataPoint>

export interface ChainAssetsChartDataPoint {
	timestamp: number
	data: { total: number } & Partial<Record<Exclude<ChainAssetCategoryKey, 'total'>, number>>
}

export type ChainAssetsChartResponse = Array<ChainAssetsChartDataPoint>

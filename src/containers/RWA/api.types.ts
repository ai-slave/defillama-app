import type { EarnPageRow } from '~/containers/Yields/data/types'
import type { RWAChartDataset, RWAPositionalChartDataset } from './chartDataset'
import type { RWAOverviewInclusionDefaults } from './constants'
import type { RWAParentPlatform } from './grouping'

type RWANumberMap = Record<string, number>
type RWAContractsByChain = Record<string, string[]>
type RWATvlByChain = Record<string, Record<string, number>>
type RWAHoldersByChain = Record<string, string[]>

// Raw API response types
export interface IFetchedRWAProject {
	id: string
	canonicalMarketId?: string | null
	ticker: string
	assetName?: string | null
	assetGroup?: string | null
	website?: string[] | null
	twitter?: string[] | null
	docs?: string | false | null
	linkedin?: string | false | null
	primaryChain?: string | null
	chain?: string[] | null
	contracts?: RWAContractsByChain | null
	category?: string[] | null
	assetClass?: string[] | null
	type?: string | null
	rwaClassification?: string | null
	accessModel?: 'Permissioned' | 'Permissionless' | 'Non-transferable' | 'Custodial Only' | 'Unknown'
	issuer?: string | null
	issuerSourceLink?: string[] | null
	issuerRegistryInfo?: string[] | null
	isin?: string | null
	attestationLinks?: string[] | null
	attestations?: boolean | null
	redeemable?: boolean | null
	cexListed?: boolean | null
	kycForMintRedeem?: boolean | null
	kycAllowlistedWhitelistedToTransferHold?: boolean | null
	transferable?: boolean | null
	selfCustody?: boolean | null
	descriptionNotes?: string[] | null
	parentPlatform?: RWAParentPlatform
	stablecoin?: boolean | null
	governance?: boolean | null
	defiActiveTvl?: RWATvlByChain | null
	onChainMcap?: RWANumberMap | null
	activeMcap?: RWANumberMap | null
	price?: number | null
	activeMcapData?: boolean
	projectId?: string | string[] | null
	coingeckoId?: string | null
	oracleProvider?: string | null
	oracleProofLink?: string | null
	logo?: string | false | null
	rwaGithub?: string | null
	dateOfLastAttestation?: string | null
	attestationFrequency?: string | string[] | null
	holdersToRemove?: RWAHoldersByChain | null
	discord?: boolean | string | null
	telegram?: boolean | string | null
}

/** One classification slice in segmented RWA stats (base, stablecoins-only, governance, both). */
export type RWAStatsSlice = {
	onChainMcap: number
	activeMcap: number
	defiActiveTvl: number
	assetCount: number
	assetIssuers: string[]
}

/** Four non-overlapping slices by asset classification (used by byChain, byCategory, byPlatform, byAssetGroup). */
export type RWAStatsSegmented = {
	base: RWAStatsSlice
	stablecoinsOnly: RWAStatsSlice
	governanceOnly: RWAStatsSlice
	stablecoinsAndGovernance: RWAStatsSlice
}

export interface IRWAStatsResponse {
	totalOnChainMcap: number
	totalActiveMcap: number
	totalDefiActiveTvl: number
	totalAssets: number
	totalIssuers: number
	byChain: Record<string, RWAStatsSegmented>
	byCategory: Record<string, RWAStatsSegmented>
	byPlatform?: Record<string, RWAStatsSegmented>
	byAssetGroup?: Record<string, RWAStatsSegmented>
}

export interface IRWAProject extends Omit<IFetchedRWAProject, 'onChainMcap' | 'activeMcap' | 'defiActiveTvl'> {
	trueRWA: boolean
	onChainMcap: {
		total: number
		breakdown: Array<[string, number]>
	} | null
	activeMcap: {
		total: number
		breakdown: Array<[string, number]>
	} | null
	defiActiveTvl: {
		total: number
		breakdown: Array<[string, number]>
	} | null
	defiActiveTvlByChain?: {
		total: number
		breakdown: Array<[string, number]>
	} | null
}

export type RWAOverviewMetric = {
	total: number
	breakdown: Array<[string, number]>
} | null

export type RWAOverviewDisplayRowBase = {
	id: string
	kind: 'spot' | 'perps'
	detailHref: string
	assetName: string
	logo?: string | false | null
	ticker: string
	primaryChain: string | null
	chain: string[] | null
	price: number | null
	openInterest: number | null
	volume24h: number | null
	volume30d: number | null
	assetGroup: string | null
	parentPlatform: string | string[] | null
	category: string[] | null
	assetClass: string[] | null
	accessModel: string | null
	type: string | null
	rwaClassification: string | null
	issuer: string | null
	redeemable: boolean | null
	attestations: boolean | null
	cexListed: boolean | null
	kycForMintRedeem: boolean | null
	kycAllowlistedWhitelistedToTransferHold: boolean | null
	transferable: boolean | null
	selfCustody: boolean | null
	stablecoin: boolean | null
	governance: boolean | null
	trueRWA: boolean
	onChainMcap: RWAOverviewMetric
	activeMcap: RWAOverviewMetric
	defiActiveTvl: RWAOverviewMetric
	defiActiveTvlByChain?: RWAOverviewMetric
}

export type RWAAssetOverviewRow = RWAOverviewDisplayRowBase & {
	kind: 'spot'
	canonicalMarketId: string
}

export type RWAPerpsContractOverlayRow = RWAOverviewDisplayRowBase & {
	kind: 'perps'
	contract: string
}

export type RWAOverviewDisplayRow = RWAAssetOverviewRow | RWAPerpsContractOverlayRow

export type RWAOverviewAssetBase = RWAOverviewDisplayRowBase
export type RWASpotOverviewAsset = RWAAssetOverviewRow
export type RWAPerpsOverviewAsset = RWAPerpsContractOverlayRow
export type RWAOverviewAsset = RWAOverviewDisplayRow

export interface IRWAAssetsOverview {
	assets: Array<RWAOverviewDisplayRow>
	types: Array<string>
	typeOptions: Array<{ key: string; name: string; help?: string }>
	assetClasses: Array<string>
	assetClassOptions: Array<{ key: string; name: string; help?: string }>
	rwaClassifications: Array<string>
	rwaClassificationOptions: Array<{ key: string; name: string; help?: string }>
	accessModels: Array<string>
	accessModelOptions: Array<{ key: string; name: string; help?: string }>
	categories: Array<string>
	categoriesOptions: Array<{ key: string; name: string; help?: string }>
	platforms: Array<string>
	assetGroups: Array<string>
	assetNames: Array<string>
	categoryValues: Array<{ name: string; value: number }>
	issuers: Array<string>
	platformLinks: Array<{ label: string; to: string }>
	selectedPlatform: string
	assetGroupLinks: Array<{ label: string; to: string }>
	selectedAssetGroup: string
	defaultInclusion: RWAOverviewInclusionDefaults
	chainLinks: Array<{ label: string; to: string }>
	selectedChain: string
	categoryLinks: Array<{ label: string; to: string }>
	selectedCategory: string
	totals: {
		onChainMcap: number
		activeMcap: number
		defiActiveTvl: number
		issuers: string[]
		stablecoins: {
			onChainMcap: number
			activeMcap: number
			defiActiveTvl: number
			issuers: string[]
		}
		governance: {
			onChainMcap: number
			activeMcap: number
			defiActiveTvl: number
			issuers: string[]
		}
		stablecoinsAndGovernance: {
			onChainMcap: number
			activeMcap: number
			defiActiveTvl: number
			issuers: string[]
		}
	}
	initialChartDataset: IRWAInitialChartDataset | null
	initialOpenInterestChartDataset: IRWAInitialTimeSeriesDataset | null
	chainSlug: string | null
	categorySlug: string | null
	platformSlug: string | null
	assetGroupSlug: string | null
}

export type IRWAInitialTimeSeriesDataset = RWAChartDataset
export type RWAChartMetricKey = 'onChainMcap' | 'activeMcap' | 'defiActiveTvl'
export type IRWAChartMetricRows = Array<{ timestamp: number } & Record<string, number>>
export type RWAAssetChartTarget =
	| { kind: 'all' }
	| { kind: 'chain'; slug: string }
	| { kind: 'category'; slug: string }
	| { kind: 'platform'; slug: string }
	| { kind: 'assetGroup'; slug: string }

export type IRWAInitialChartDataset = {
	metric: RWAChartMetricKey
	dataset: RWAPositionalChartDataset
}

export interface IRWAChartDataByAsset {
	onChainMcap: IRWAChartMetricRows
	activeMcap: IRWAChartMetricRows
	defiActiveTvl: IRWAChartMetricRows
}

export type IRWABreakdownChartRow = { timestamp: number } & Record<string, number>

export type IRWABreakdownChartResponse = IRWABreakdownChartRow[]

export type IRWABreakdownChartParams = {
	key?: RWAChartMetricKey
	includeStablecoin?: boolean
	includeGovernance?: boolean
}

export type IRWAAssetChartApiRow = {
	timestamp: number
	onChainMcap: number | null
	activeMcap: number | null
	defiActiveTvl: number | null
	totalSupply?: number | null
}

export type IRWAFlowsRequest = {
	start?: number
	end?: number
	withMcap?: boolean
}

export type IRWAFlowPoint = {
	timestamp: number
	netFlowUsd: number | null
	netFlowByChain: Record<string, number>
	missingChains?: string[]
	unpricedChains?: string[]
	mcap?: number | null
}

export type IRWAFlowsResponse = {
	id: string
	start: number
	end: number
	data: IRWAFlowPoint[]
	coverage: number
}

export type IRWAFlowAggregatePoint = {
	timestamp: number
	netFlowUsd: number | null
	coverage: number
}

export type IRWAFlowAggregateResponse = {
	series: IRWAFlowAggregatePoint[]
	coverage: number
	members?: string[]
}

export type RWAFlowOverviewSplitBy = 'assetGroup' | 'category' | 'platform' | 'chain'

export type IRWAFlowOverviewRequest = {
	splitBy: RWAFlowOverviewSplitBy
	includeStablecoin: boolean
	includeGovernance: boolean
}

export type IRWAFlowOverviewSplitPoint = { timestamp: number } & Record<string, number>

export type IRWAFlowAssetBreakdownRow = { timestamp: number } & Record<string, number>

export type RWAFlowWindow = '7d' | '30d'

export type IRWAFlowSummary = {
	flow: number | null
	mcap: number
	intensityPct: number | null
	coverage: number
}

export type RWAChainFlowSummary =
	| { status: 'measured'; flow: number; coverage: number }
	| { status: 'notPriced' }
	| { status: 'unknown' }

export type IRWAAssetFlowSummary = IRWAFlowSummary & {
	byChain: Record<string, RWAChainFlowSummary>
}

export type IRWAFlowSummaryWindow = {
	asset: Record<string, IRWAAssetFlowSummary>
	assetGroup: Record<string, IRWAFlowSummary>
	platform: Record<string, IRWAFlowSummary>
	category: Record<string, IRWAFlowSummary>
	chain: Record<string, IRWAFlowSummary>
}

export type IRWAFlowSummaryResponse = {
	generatedAt: number
	windows: Record<RWAFlowWindow, IRWAFlowSummaryWindow>
}

export type RWAOverviewPage = { kind: 'chain' } | { kind: 'category' } | { kind: 'platform' } | { kind: 'assetGroup' }
export type RWAOverviewBreakdownRequest =
	| { breakdown: 'chain'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }
	| { breakdown: 'category'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }
	| { breakdown: 'platform'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }
	| { breakdown: 'assetGroup'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }

export type IRWAChainsOverviewRow = NonNullable<IRWAStatsResponse['byChain']>[string] & { chain: string }

export type IRWACategoriesOverviewRow = NonNullable<IRWAStatsResponse['byCategory']>[string] & { category: string }
export type IRWAPlatformsOverviewRow = NonNullable<IRWAStatsResponse['byPlatform']>[string] & { platform: string }
export type IRWAAssetGroupsOverviewRow = NonNullable<IRWAStatsResponse['byAssetGroup']>[string] & { assetGroup: string }

export type IRWAChainsOverview = {
	rows: IRWAChainsOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
}

export type IRWACategoriesOverview = {
	rows: IRWACategoriesOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
}

export type IRWAPlatformsOverview = {
	rows: IRWAPlatformsOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
}

export type IRWAAssetGroupsOverview = {
	rows: IRWAAssetGroupsOverviewRow[]
	initialChartDataset: RWAPositionalChartDataset
}

export type RWADefiTvlProtocolBreakdown = {
	protocol: string
	total: number
	byChain: Array<[string, number]>
}

export interface IRWAAssetData extends IRWAProject {
	slug: string
	defiActiveTvlByProtocolChain: RWADefiTvlProtocolBreakdown[] | null
	rwaClassificationDescription: string | null
	accessModelDescription: string | null
	assetClassDescriptions: Record<string, string>
	contractUrls: Record<string, Record<string, string>> | null
	chartDataset: RWAPositionalChartDataset | null
	yieldPools: EarnPageRow[] | null
	yieldPoolsTotal: number | null
	nativeYieldPoolId: string | null
	nativeYieldCurrent: number | null
}

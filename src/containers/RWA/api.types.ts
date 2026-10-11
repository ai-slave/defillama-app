import type { EarnPageRow } from '~/containers/Yields/data/types'
import type { RwaOverviewCards, RwaPerpsTotals } from './cards/cardData'
import type { RWAPositionalChartDataset } from './chartDataset'
import type { RWAChartMetricAvailability } from './chartState'
import type { RWAOverviewInclusionDefaults } from './constants'
import type { RWAPerpsVenueType } from './Perps/api.types'
import type { RWAPlatformMeta } from './PlatformPage/api.types'
import type { RWAGroupBy } from './table/groupBy'

/** The platform page's own data: the index entry. Every number on the page is a fold over the table's rows. */
export type RWAPlatformPageData = {
	meta: RWAPlatformMeta
}

type RWANumberMap = Record<string, number>
type RWAContractsByChain = Record<string, Array<string>>
type RWATvlByChain = Record<string, Record<string, number>>
type RWAHoldersByChain = Record<string, Array<string>>

export type RWAAccessModel = 'Permissioned' | 'Permissionless' | 'Non-transferable' | 'Custodial Only' | 'Unknown'

// Raw API response types
export interface IFetchedRWAProject {
	id: string
	canonicalMarketId: string
	ticker: string
	assetName?: string | null
	assetGroup?: string | null
	website?: Array<string> | null
	twitter?: Array<string> | null
	docs?: string | null
	linkedin?: string | null
	primaryChain?: string | null
	chain?: Array<string> | null
	contracts?: RWAContractsByChain | null
	category?: Array<string> | null
	assetClass?: Array<string> | null
	type?: string | null
	rwaClassification?: string | null
	accessModel: RWAAccessModel
	issuer?: string | null
	issuerSourceLink?: Array<string> | null
	issuerRegistryInfo?: Array<string> | null
	isin?: string | null
	attestationLinks?: Array<string> | null
	attestations?: boolean | null
	redeemable?: boolean | null
	cexListed?: boolean | null
	kycForMintRedeem?: boolean | null
	kycAllowlistedWhitelistedToTransferHold?: boolean | null
	transferable?: boolean | null
	selfCustody?: boolean | null
	descriptionNotes?: Array<string> | null
	parentPlatform?: string | null
	stablecoin: boolean
	governance: boolean
	defiActiveTvl: RWATvlByChain
	/** Per-chain bridge/interop portion of defiActiveTvl (server /current). Exclude view subtracts this. */
	bridgeTvl?: RWANumberMap | null
	/** Bridge/interop portion of defiActiveTvl by chain and protocol. */
	bridgeTvlBreakdown?: RWATvlByChain | null
	onChainMcap: RWANumberMap
	activeMcap?: RWANumberMap
	price: number | null
	activeMcapData?: boolean | null
	projectId?: string | Array<string> | null
	coingeckoId?: string | null
	oracleProvider?: string | null
	oracleProofLink?: string | null
	logo?: string | null
	rwaGithub?: string | null
	dateOfLastAttestation?: string | null
	attestationFrequency?: string | null
	holdersToRemove?: RWAHoldersByChain | null
	discord?: string | null
	telegram?: string | null
	suspicious?: boolean | null
	suspiciousReason?: string | null
}

/** One classification slice in segmented RWA stats (base, stablecoins-only, governance, both). */
export type RWAStatsSlice = {
	onChainMcap: number
	activeMcap: number
	defiActiveTvl: number
	/** Portion of defiActiveTvl from bridge/interop-category protocols. Exclude view = defiActiveTvl - bridgeTvl. Absent until server deploy. */
	bridgeTvl?: number
	assetCount: number
	assetIssuers: Array<string>
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
	totalBridgeTvl?: number
	assetCount: number
	assetIssuers: number
	byChain: Record<string, RWAStatsSegmented>
	byCategory: Record<string, RWAStatsSegmented>
	byPlatform: Record<string, RWAStatsSegmented>
	byAssetGroup: Record<string, RWAStatsSegmented>
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
	logo?: string | null
	ticker: string
	primaryChain: string | null
	chain: Array<string> | null
	price: number | null
	openInterest: number | null
	volume24h: number | null
	volume30d: number | null
	assetGroup: string | null
	parentPlatform: string | null
	category: Array<string> | null
	assetClass: Array<string> | null
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
	suspicious: boolean
	suspiciousReason: string | null
	onChainMcap: RWAOverviewMetric
	activeMcap: RWAOverviewMetric
	defiActiveTvl: RWAOverviewMetric
	defiActiveTvlByChain?: RWAOverviewMetric
}

export type RWAAssetOverviewRow = RWAOverviewDisplayRowBase & {
	kind: 'spot'
	canonicalMarketId: string
	accessModel: RWAAccessModel
	stablecoin: boolean
	governance: boolean
	defiActiveTvl: Exclude<RWAOverviewMetric, null>
	defiActiveTvlByChain: Exclude<RWAOverviewMetric, null>
	// Bridge/interop portion of defiActiveTvl (chain-filtered to match the row total). Subtracted when the toggle is off.
	bridgeTvl?: number
	// Per-chain bridge values used to keep chain breakdowns consistent with the total.
	bridgeTvlByChain?: Exclude<RWAOverviewMetric, null>
	// Protocol bridge values used to keep the asset table breakdown consistent with the total.
	bridgeTvlByProtocol?: RWAOverviewMetric
	/** Values 1d, 7d and 1m before the latest series point. */
	priors?: RWAPriors
	/** First series point with a value, in ms. */
	firstSeen?: number | null
}

export type RWAPriorPeriod = '1d' | '7d' | '1m'
export type RWAPriors = Record<RWAPriorPeriod, RWAPrior>

/** Value before the latest point: null on a gap, 0 when the asset did not exist yet. */
export type RWAPrior = {
	activeMcap: number | null
	onChainMcap: number | null
	defiActiveTvl: number | null
	bridgeTvl: number | null
}

export type RWAPerpsContractOverlayRow = RWAOverviewDisplayRowBase & {
	kind: 'perps'
	contract: string
	venueType: RWAPerpsVenueType
	/** Mark price move over 24h, in percent. */
	priceChange24h?: number | null
	/** Open interest change over 24h, in percent. */
	openInterestChange24h?: number | null
	volume7d?: number | null
	/** Funding rate per interval as a fraction; positive means longs pay shorts. */
	fundingRate?: number | null
	fundingIntervalHours?: number | null
	/** Mark price over index price, minus one. */
	premium?: number | null
	maxLeverage?: number | null
	protocolFees24h?: number | null
	/** Snapshot time, in seconds. */
	timestamp?: number | null
	venue?: string | null
	/** 24h volume change, in percent. */
	volume24hChange24h?: number | null
	volumeAllTime?: number | null
	oraclePrice?: number | null
	midPrice?: number | null
	previousDayPrice?: number | null
	protocolFees7d?: number | null
	protocolFees30d?: number | null
	protocolFeesAllTime?: number | null
	pair?: string | null
	marginAsset?: string | null
	settlementAsset?: string | null
	sizeDecimals?: number | null
	/** Fee rates as fractions. */
	makerFeeRate?: number | null
	takerFeeRate?: number | null
	oracleProvider?: string | null
	website?: Array<string> | null
}

export type RWAOverviewDisplayRow = RWAAssetOverviewRow | RWAPerpsContractOverlayRow

export type RWASpotOverviewAsset = RWAAssetOverviewRow

/** A page's nav row: its heading, its links ('All' first) and the label of the page it is on. */
export type RWAPageNav = { heading: string; links: Array<{ label: string; to: string }>; active: string }

export interface IRWAAssetsOverview {
	platformPage: RWAPlatformPageData | null
	assets: Array<RWAOverviewDisplayRow>
	typeOptions: Array<{ key: string; name: string; help?: string }>
	assetClassOptions: Array<{ key: string; name: string; help?: string }>
	rwaClassificationOptions: Array<{ key: string; name: string; help?: string }>
	accessModelOptions: Array<{ key: string; name: string; help?: string }>
	categoriesOptions: Array<{ key: string; name: string; help?: string }>
	platforms: Array<string>
	assetGroups: Array<string>
	assetNames: Array<string>
	issuers: Array<string>
	/** The row of sibling pages under the tabs. */
	nav: RWAPageNav
	selectedPlatform: string
	selectedAssetGroup: string
	defaultInclusion: RWAOverviewInclusionDefaults
	selectedChain: string
	selectedCategory: string
	/** The Key Metrics card's perps section on an Assets page, folded at build: the page ships no perps rows. */
	perpsTotals: RwaPerpsTotals
	/** The chart datasets folded at build time: the default Group by on every page, plus Chain on the front page. */
	initialChartDatasets: Array<IRWAInitialChartDataset>
	/** The front page cards, folded at build time; null on scoped pages. */
	cards: RwaOverviewCards | null
	chartMetricAvailability: RWAChartMetricAvailability
	platformLogos: Record<string, string>
	/** Latest series point in ms, the page's reference for time windows. */
	seriesLatestTimestamp: number | null
	chainSlug: string | null
	categorySlug: string | null
	platformSlug: string | null
	assetGroupSlug: string | null
}

/** The lists and scope names the Assets tree's spot filters read; the Perps tree filters through perpsFilters.ts. */
export type RWASpotFilterKey =
	| 'typeOptions'
	| 'assetClassOptions'
	| 'rwaClassificationOptions'
	| 'accessModelOptions'
	| 'categoriesOptions'
	| 'platforms'
	| 'assetGroups'
	| 'assetNames'
	| 'issuers'
	| 'selectedPlatform'
	| 'selectedChain'
	| 'selectedCategory'
	| 'chainSlug'
	| 'categorySlug'
	| 'platformSlug'

/** The fields only an Assets page reads: its spot chart, its spot cards, its platform profile, its perps totals and its spot filters. */
type RWASpotOnlyKey =
	| RWASpotFilterKey
	| 'platformPage'
	| 'perpsTotals'
	| 'initialChartDatasets'
	| 'cards'
	| 'chartMetricAvailability'
	| 'seriesLatestTimestamp'

/** The fields every /rwa page carries: a Perps page's whole frame; an Assets page adds the spot-only ones. */
export type RWAOverviewFrame = Omit<IRWAAssetsOverview, RWASpotOnlyKey>

export type RWAChartMetricKey = 'onChainMcap' | 'activeMcap' | 'defiActiveTvl'
export type IRWAChartMetricRows = Array<{ timestamp: number } & Record<string, number>>
export type RWAAssetChartTarget =
	| { kind: 'all' }
	| { kind: 'chain'; slug: string }
	| { kind: 'category'; slug: string }
	| { kind: 'platform'; slug: string }
	| { kind: 'assetGroup'; slug: string }

/** A chart dataset folded at build time for the page's default state: one metric, one Group by. */
export type IRWAInitialChartDataset = {
	metric: RWAChartMetricKey
	groupBy: RWAGroupBy
	dataset: RWAPositionalChartDataset
}

export interface IRWAChartDataByAsset {
	onChainMcap: IRWAChartMetricRows
	activeMcap: IRWAChartMetricRows
	defiActiveTvl: IRWAChartMetricRows
	/** Per-asset bridge/interop portion of defiActiveTvl; subtracted when the bridge toggle is off. Absent until server deploy. */
	bridgeTvl?: IRWAChartMetricRows
}

export type IRWABreakdownChartRow = { timestamp: number } & Record<string, number>

export type IRWABreakdownChartResponse = Array<IRWABreakdownChartRow>

export type IRWABreakdownChartParams = {
	key?: RWAChartMetricKey | 'bridgeTvl'
	includeStablecoin?: boolean
	includeGovernance?: boolean
}

export type IRWAAssetChartApiRow = {
	timestamp: number
	onChainMcap: number | null
	activeMcap: number | null
	defiActiveTvl: number | null
	totalSupply: number | null
}

export type IRWAFlowPoint = {
	timestamp: number
	netFlowUsd: number | null
	netFlowByChain: Record<string, number>
	missingChains?: Array<string>
	unpricedChains?: Array<string>
}

export type IRWAFlowPointWithMcap = IRWAFlowPoint & { mcap: number | null }

export type IRWAFlowsResponse<TPoint extends IRWAFlowPoint = IRWAFlowPoint> = {
	id: string
	start: number
	end: number
	data: Array<TPoint>
	coverage: number
}

export type IRWAFlowAggregatePoint = {
	timestamp: number
	netFlowUsd: number | null
	coverage: number
}

export type RWAFlowOverviewSplitBy = 'assetGroup' | 'category' | 'platform' | 'chain'

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

export type RWAOverviewBreakdownRequest =
	| { breakdown: 'chain'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }
	| { breakdown: 'category'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }
	| { breakdown: 'platform'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }
	| { breakdown: 'assetGroup'; key: RWAChartMetricKey; includeStablecoin: boolean; includeGovernance: boolean }

export type RWAOverviewBreakdownRouteRequest = RWAOverviewBreakdownRequest & {
	includeBridgeTvl: boolean
}

export type RWADefiTvlProtocolBreakdown = {
	protocol: string
	total: number
	byChain: Array<[string, number]>
}

export interface IRWAAssetData extends IRWAProject {
	slug: string
	/** The asset's own DeFiLlama protocol listing(s), resolved from projectId. */
	protocolLinks: Array<{ name: string; slug: string }>
	defiActiveTvlByProtocolChain: Array<RWADefiTvlProtocolBreakdown> | null
	rwaClassificationDescription: string | null
	accessModelDescription: string | null
	assetClassDescriptions: Record<string, string>
	contractUrls: Record<string, Record<string, string>> | null
	chartDataset: RWAPositionalChartDataset | null
	yieldPools: Array<EarnPageRow> | null
	yieldPoolsTotal: number | null
	nativeYieldPoolId: string | null
	nativeYieldCurrent: number | null
}

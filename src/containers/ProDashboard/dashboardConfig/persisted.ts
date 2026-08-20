import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
import type { AIGeneratedData, CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import type {
	AdvancedTvlChartConfig,
	BorrowedChartConfig,
	DashboardGrouping,
	DatasetTableConfig,
	IncomeStatementConfig,
	LlamaAIChartConfig,
	RWAAssetChartConfig,
	SqlChartConfig,
	StablecoinAssetChartConfig,
	StablecoinsChartConfig,
	TextConfig,
	UnlocksPieConfig,
	UnlocksScheduleConfig,
	UnlocksDataType,
	YieldsChartConfig
} from '../types'
import type { ChartConfigInput } from './classicChartConfig'
import type { StoredColSpan } from './colSpan'

/** Snapshot of the shared filter bag read by the original table implementations. */
export interface UnifiedTableV1Filters {
	protocols?: string[]
	tokens?: string[]
	categories?: string[]
	excludedCategories?: string[]
	oracles?: string[]
	apyMin?: number
	apyMax?: number
	tvlMin?: number
	tvlMax?: number
	baseApyMin?: number
	baseApyMax?: number
	chains?: string[]
	hasRewards?: boolean
	stablesOnly?: boolean
	activeLending?: boolean
	poolTypes?: string[]
	mcapMin?: number
	mcapMax?: number
	protocolAgeDaysMin?: number
	protocolAgeDaysMax?: number
	volumeDex24hMin?: number
	volumeDex24hMax?: number
	fees24hMin?: number
	fees24hMax?: number
	revenue24hMin?: number
	revenue24hMax?: number
	volume7dMin?: number
	volume7dMax?: number
	volume30dMin?: number
	volume30dMax?: number
	fees7dMin?: number
	fees7dMax?: number
	fees30dMin?: number
	fees30dMax?: number
	fees1yMin?: number
	fees1yMax?: number
	revenue7dMin?: number
	revenue7dMax?: number
	revenue30dMin?: number
	revenue30dMax?: number
	revenue1yMin?: number
	revenue1yMax?: number
	change1dMin?: number
	change1dMax?: number
	change7dMin?: number
	change7dMax?: number
	change1mMin?: number
	change1mMax?: number
	volumeChange1dMin?: number
	volumeChange1dMax?: number
	volumeChange7dMin?: number
	volumeChange7dMax?: number
	volumeChange1mMin?: number
	volumeChange1mMax?: number
	feesChange1dMin?: number
	feesChange1dMax?: number
	feesChange7dMin?: number
	feesChange7dMax?: number
	feesChange1mMin?: number
	feesChange1mMax?: number
	revenueChange1dMin?: number
	revenueChange1dMax?: number
	revenueChange7dMin?: number
	revenueChange7dMax?: number
	revenueChange1mMin?: number
	revenueChange1mMax?: number
	volumeDominance24hMin?: number
	volumeDominance24hMax?: number
	volumeMarketShare7dMin?: number
	volumeMarketShare7dMax?: number
	tvlShareMin?: number
	tvlShareMax?: number
	perpsVolumeDominance24hMin?: number
	perpsVolumeDominance24hMax?: number
	optionsVolumeDominance24hMin?: number
	optionsVolumeDominance24hMax?: number
	holderRevenue24hMin?: number
	holderRevenue24hMax?: number
	treasuryRevenue24hMin?: number
	treasuryRevenue24hMax?: number
	stablesMcapMin?: number
	stablesMcapMax?: number
	bridgedTvlMin?: number
	bridgedTvlMax?: number
	aggregatorsVolume24hMin?: number
	aggregatorsVolume24hMax?: number
	aggregatorsVolume7dMin?: number
	aggregatorsVolume7dMax?: number
	aggregatorsVolume30dMin?: number
	aggregatorsVolume30dMax?: number
	derivativesAggregatorsVolume24hMin?: number
	derivativesAggregatorsVolume24hMax?: number
	derivativesAggregatorsVolume7dMin?: number
	derivativesAggregatorsVolume7dMax?: number
	derivativesAggregatorsVolume30dMin?: number
	derivativesAggregatorsVolume30dMax?: number
	hasPerps?: boolean
	hasOptions?: boolean
	hasOpenInterest?: boolean
	hasVolume?: boolean
	hasFees?: boolean
	hasRevenue?: boolean
	hasMarketCap?: boolean
	hasAggregators?: boolean
	hasDerivativesAggregators?: boolean
	hasBridgedTVL?: boolean
	hasStables?: boolean
	hasHolderRevenue?: boolean
	hasTreasuryRevenue?: boolean
	hasMcapTVLRatio?: boolean
	protocolCountMin?: number
	protocolCountMax?: number
	pfRatioMin?: number
	pfRatioMax?: number
}

/** Snapshot of the protocol filters persisted by Unified Table v2 and early v3 configs. */
export interface PersistedUnifiedTableV3Filters {
	protocols?: string[]
	tokens?: string[]
	categories?: string[]
	excludedCategories?: string[]
	oracles?: string[]
	apyMin?: number
	apyMax?: number
	tvlMin?: number
	tvlMax?: number
	baseApyMin?: number
	baseApyMax?: number
	chains?: string[]
	hasRewards?: boolean
	stablesOnly?: boolean
	activeLending?: boolean
	poolTypes?: string[]
	mcapMin?: number
	mcapMax?: number
	protocolAgeDaysMin?: number
	protocolAgeDaysMax?: number
	volumeDex24hMin?: number
	volumeDex24hMax?: number
	fees24hMin?: number
	fees24hMax?: number
	revenue24hMin?: number
	revenue24hMax?: number
	volume7dMin?: number
	volume7dMax?: number
	volume30dMin?: number
	volume30dMax?: number
	fees7dMin?: number
	fees7dMax?: number
	fees30dMin?: number
	fees30dMax?: number
	fees1yMin?: number
	fees1yMax?: number
	revenue7dMin?: number
	revenue7dMax?: number
	revenue30dMin?: number
	revenue30dMax?: number
	revenue1yMin?: number
	revenue1yMax?: number
	change1dMin?: number
	change1dMax?: number
	change7dMin?: number
	change7dMax?: number
	change1mMin?: number
	change1mMax?: number
	volumeChange1dMin?: number
	volumeChange1dMax?: number
	volume24hChange7dAgoMin?: number
	volume24hChange7dAgoMax?: number
	volume24hChange30dAgoMin?: number
	volume24hChange30dAgoMax?: number
	volumeChange7dOver7dMin?: number
	volumeChange7dOver7dMax?: number
	volumeChange30dOver30dMin?: number
	volumeChange30dOver30dMax?: number
	feesChange1dMin?: number
	feesChange1dMax?: number
	fees24hChange7dAgoMin?: number
	fees24hChange7dAgoMax?: number
	fees24hChange30dAgoMin?: number
	fees24hChange30dAgoMax?: number
	feesChange7dOver7dMin?: number
	feesChange7dOver7dMax?: number
	feesChange30dOver30dMin?: number
	feesChange30dOver30dMax?: number
	revenueChange1dMin?: number
	revenueChange1dMax?: number
	revenue24hChange7dAgoMin?: number
	revenue24hChange7dAgoMax?: number
	revenue24hChange30dAgoMin?: number
	revenue24hChange30dAgoMax?: number
	revenueChange7dOver7dMin?: number
	revenueChange7dOver7dMax?: number
	revenueChange30dOver30dMin?: number
	revenueChange30dOver30dMax?: number
	volumeDominance24hMin?: number
	volumeDominance24hMax?: number
	volumeMarketShare7dMin?: number
	volumeMarketShare7dMax?: number
	tvlShareMin?: number
	tvlShareMax?: number
	perpsVolumeDominance24hMin?: number
	perpsVolumeDominance24hMax?: number
	optionsVolumeDominance24hMin?: number
	optionsVolumeDominance24hMax?: number
	holderRevenue24hMin?: number
	holderRevenue24hMax?: number
	stablesMcapMin?: number
	stablesMcapMax?: number
	bridgedTvlMin?: number
	bridgedTvlMax?: number
	aggregatorsVolume24hMin?: number
	aggregatorsVolume24hMax?: number
	aggregatorsVolume7dMin?: number
	aggregatorsVolume7dMax?: number
	aggregatorsVolume30dMin?: number
	aggregatorsVolume30dMax?: number
	derivativesAggregatorsVolume24hMin?: number
	derivativesAggregatorsVolume24hMax?: number
	derivativesAggregatorsVolume7dMin?: number
	derivativesAggregatorsVolume7dMax?: number
	derivativesAggregatorsVolume30dMin?: number
	derivativesAggregatorsVolume30dMax?: number
	hasPerps?: boolean
	hasOptions?: boolean
	hasOpenInterest?: boolean
	hasVolume?: boolean
	hasFees?: boolean
	hasRevenue?: boolean
	hasMarketCap?: boolean
	hasAggregators?: boolean
	hasDerivativesAggregators?: boolean
	hasBridgedTVL?: boolean
	hasStables?: boolean
	hasHolderRevenue?: boolean
	hasMcapTVLRatio?: boolean
	protocolCountMin?: number
	protocolCountMax?: number
	pfRatioMin?: number
	pfRatioMax?: number
}

export interface UnifiedTableV2Filters extends PersistedUnifiedTableV3Filters {
	treasuryRevenue24hMin?: number
	treasuryRevenue24hMax?: number
	hasTreasuryRevenue?: boolean
}

interface PersistedUnifiedTableCustomColumn {
	id: string
	name: string
	expression: string
	format: 'usd' | 'percent' | 'ratio' | 'number'
	aggregation: 'sum' | 'first' | 'none' | 'recalculate'
}

interface PersistedUnifiedTableConfigBase {
	id: string
	kind: 'unified-table'
	strategy: 'protocols'
	rowHeaders: Array<'parent-protocol' | 'protocol' | 'chain' | 'category'>
	defaultSorting?: Array<{ id: string; desc: boolean }>
	params?: { chains?: string[]; category?: string | null } | null
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	activePresetId?: string
	colSpan?: StoredColSpan
	customColumns?: PersistedUnifiedTableCustomColumn[]
}

export interface UnifiedTableV1Config extends PersistedUnifiedTableConfigBase {
	configVersion: 1
	filters?: UnifiedTableV1Filters
}

export interface UnifiedTableV2Config extends PersistedUnifiedTableConfigBase {
	configVersion: 2
	filters?: UnifiedTableV2Filters
}

export interface PersistedUnifiedTableV3Config extends PersistedUnifiedTableConfigBase {
	configVersion: 3
	filters?: PersistedUnifiedTableV3Filters
}

export interface UnversionedUnifiedTableConfig {
	id: string
	kind: 'unified-table'
	rowHeaders: Array<'parent-protocol' | 'protocol' | 'chain' | 'category'>
	defaultSorting?: Array<{ id: string; desc?: boolean }>
	params?: { chains?: string[]; category?: string | null } | null
	filters?: UnifiedTableV1Filters
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	activePresetId?: string
	colSpan?: StoredColSpan
	customColumns?: PersistedUnifiedTableCustomColumn[]
}

export interface PersistedProtocolTableFilters extends UnifiedTableV1Filters {
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
	tokenSymbols?: string[]
}

interface PersistedProtocolsTableConfigBase {
	id: string
	kind: 'table'
	colSpan?: StoredColSpan
	filters?: PersistedProtocolTableFilters
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	customColumns?: Array<{
		id: string
		name: string
		expression: string
		isValid: boolean
		errorMessage?: string
	}>
	activePresetId?: string
	datasetChain?: string
	tokenSymbols?: string[]
	includeCex?: boolean
}

export interface PersistedProtocolsTableConfig extends PersistedProtocolsTableConfigBase {
	tableType: 'protocols'
	chains: string[]
}

export interface ProtocolsTableConfigWithoutTableType extends PersistedProtocolsTableConfigBase {
	chain: string
}

export interface ProtocolsTableConfigWithoutChains extends PersistedProtocolsTableConfigBase {
	tableType: 'protocols'
}

export type PersistedDatasetType =
	| 'stablecoins'
	| 'cex'
	| 'cex-analytics'
	| 'revenue'
	| 'holders-revenue'
	| 'earnings'
	| 'fees'
	| 'token-usage'
	| 'yields'
	| 'aggregators'
	| 'perps'
	| 'options'
	| 'dexs'
	| 'bridge-aggregators'
	| 'chains'
	| 'rwa'
	| 'rwa-chains'
	| 'rwa-selected-chain'
	| 'equities'
	| 'equities-financials'
	| 'equities-filings'
	| 'trending-contracts'

/**
 * Historical chart subject contract, written before chart subjects were discriminated.
 * Protocol charts stored `protocol` together with the meaningless `chain: ''` sentinel.
 * Read-time migration removes that sentinel; persisted dashboards are not rewritten in place.
 */
export interface PersistedLegacyChartConfig {
	id: string
	kind: 'chart'
	chain: string
	protocol?: string
	type: string
	color?: string
	grouping?: DashboardGrouping
	geckoId?: string | null
	dataType?: UnlocksDataType
	colSpan?: StoredColSpan
	showCumulative?: boolean
}

export type PersistedChartConfig = ChartConfigInput | PersistedLegacyChartConfig

export interface PersistedMultiChartConfig {
	id: string
	kind: 'multi'
	name?: string
	items: PersistedChartConfig[]
	grouping?: DashboardGrouping
	colSpan?: StoredColSpan
	showCumulative?: boolean
	showPercentage?: boolean
	showStacked?: boolean
	showTreemap?: boolean
}

/**
 * Historical metric display contract. `showSparkline` preceded the explicit chart type.
 * Read-time migration preserves false as `none`; true or omission retain the historical sparkline default.
 */
export interface PersistedLegacyMetricConfig {
	id: string
	kind: 'metric'
	subject:
		| {
				itemType: 'chain'
				chain: string
				protocol?: never
				geckoId?: string | null
		  }
		| {
				itemType: 'protocol'
				protocol: string
				chain?: never
				geckoId?: string | null
		  }
	type: string
	aggregator: 'latest' | 'avg' | 'max' | 'min' | 'sum' | 'median' | 'stddev' | 'first' | 'growth' | 'movingavg'
	window: '7d' | '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all'
	compare?: {
		mode: 'previous_window' | 'previous_value' | 'none'
		format?: 'percent' | 'absolute'
	}
	chartType?: 'sparkline' | 'bar' | 'none'
	showSparkline?: boolean
	label?: string
	format?: {
		value?: 'currency' | 'number' | 'percent' | 'auto'
		decimals?: number
		compact?: boolean
	}
	colSpan?: StoredColSpan
}

/** Historical RWA overview aliases were accepted by Pro but both rendered the chain breakdown. */
export interface PersistedRWAOverviewChartConfig {
	id: string
	kind: 'rwa-overview'
	metric: 'activeMcap' | 'onChainMcap' | 'defiActiveTvl'
	chartView: 'timeSeries' | 'pie' | 'treemap' | 'hbar'
	breakdown: 'chain' | 'category' | 'platform' | 'assetGroup' | 'assetClass' | 'assetName'
	chain?: string
	treemapNestedBy?: string
	colSpan?: StoredColSpan
}

type PersistedJsonValue =
	| string
	| number
	| boolean
	| null
	| PersistedJsonValue[]
	| { [key: string]: PersistedJsonValue }

/** Frozen Chart Builder contract read from saved dashboards; migration produces the current runtime config. */
export interface PersistedChartBuilderConfig {
	id: string
	kind: 'builder'
	name?: string
	config: {
		metric:
			| 'fees'
			| 'revenue'
			| 'volume'
			| 'perps'
			| 'open-interest'
			| 'options-notional'
			| 'options-premium'
			| 'bridge-aggregators'
			| 'dex-aggregators'
			| 'perps-aggregators'
			| 'user-fees'
			| 'holders-revenue'
			| 'protocol-revenue'
			| 'supply-side-revenue'
			| 'tvl'
			| 'stablecoins'
			| 'chain-fees'
			| 'chain-revenue'
		mode: 'chains' | 'protocol'
		filterMode?: 'include' | 'exclude'
		chainFilterMode?: 'include' | 'exclude'
		categoryFilterMode?: 'include' | 'exclude'
		chainCategoryFilterMode?: 'include' | 'exclude'
		protocolCategoryFilterMode?: 'include' | 'exclude'
		protocol?: string
		chains: string[]
		chainCategories?: string[]
		protocolCategories?: string[]
		categories: string[]
		groupBy: 'protocol'
		limit: number
		chartType: 'stackedBar' | 'stackedArea' | 'line' | 'treemap'
		treemapValue?: 'latest' | 'sum7d' | 'sum30d'
		displayAs: 'timeSeries' | 'percentage'
		hideOthers?: boolean
		groupByParent?: boolean
		seriesColors?: Record<string, string>
		additionalFilters?: Record<string, PersistedJsonValue>
	}
	grouping?: DashboardGrouping
	colSpan?: StoredColSpan
}

/** Historical persisted table contract. Migration is its only runtime consumer. */
export interface PersistedDatasetTableConfig {
	id: string
	kind: 'table'
	tableType: 'dataset'
	datasetType?: PersistedDatasetType
	chains?: string[]
	colSpan?: StoredColSpan
	filters?: UnifiedTableV1Filters
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	datasetChain?: string
	tokenSymbols?: string[]
	includeCex?: boolean
	cexAnalyticsView?: CexAnalyticsView | 'efficiency'
	cexAnalyticsMetric?: CexAnalyticsMetric
	cexAnalyticsTopN?: number
	datasetTimeframe?: string
}

export type PersistedProtocolMetricDatasetType =
	| 'revenue'
	| 'holders-revenue'
	| 'earnings'
	| 'fees'
	| 'aggregators'
	| 'perps'
	| 'options'
	| 'dexs'
	| 'bridge-aggregators'

export interface PersistedProtocolMetricDatasetFilters {
	categories?: string[]
	excludedCategories?: string[]
}

type PersistedFilterableProtocolMetricDatasetType = 'revenue' | 'holders-revenue' | 'earnings'

/**
 * Transitional `dataset-table` protocol metric contract written before those tables moved to Unified Table.
 * It is read only by the dashboard migration and is intentionally absent from the runtime item union.
 */
export type PersistedProtocolMetricDatasetTableConfig = {
	[DatasetType in PersistedProtocolMetricDatasetType]: {
		id: string
		kind: 'dataset-table'
		datasetType: DatasetType
		chains: string[]
		colSpan?: StoredColSpan
	} & (DatasetType extends PersistedFilterableProtocolMetricDatasetType
		? { filters?: PersistedProtocolMetricDatasetFilters }
		: Record<never, never>)
}[PersistedProtocolMetricDatasetType]

export type PersistedDashboardItemConfig =
	| AdvancedTvlChartConfig
	| BorrowedChartConfig
	| DatasetTableConfig
	| IncomeStatementConfig
	| LlamaAIChartConfig
	| RWAAssetChartConfig
	| SqlChartConfig
	| StablecoinAssetChartConfig
	| StablecoinsChartConfig
	| TextConfig
	| UnlocksPieConfig
	| UnlocksScheduleConfig
	| YieldsChartConfig
	| PersistedChartBuilderConfig
	| PersistedChartConfig
	| PersistedLegacyMetricConfig
	| PersistedMultiChartConfig
	| PersistedRWAOverviewChartConfig
	| PersistedProtocolMetricDatasetTableConfig
	| PersistedProtocolsTableConfig
	| ProtocolsTableConfigWithoutTableType
	| ProtocolsTableConfigWithoutChains
	| PersistedDatasetTableConfig
	| UnversionedUnifiedTableConfig
	| UnifiedTableV1Config
	| UnifiedTableV2Config
	| PersistedUnifiedTableV3Config

export interface PersistedDashboard {
	id: string
	slug?: string
	user?: string
	data: {
		items: PersistedDashboardItemConfig[]
		dashboardName: string
		timePeriod?: TimePeriod
		customTimePeriod?: CustomTimePeriod | null
		aiUndoState?: {
			items: PersistedDashboardItemConfig[]
			timestamp: string
			sessionId: string
		} | null
	}
	visibility?: 'private' | 'public'
	tags?: string[]
	description?: string
	viewCount?: number
	likeCount?: number
	liked?: boolean
	author?: PublicDashboardAuthor
	created: string
	updated: string
	editedAt?: string
	collectionId?: string
	collectionName?: string
	aiGenerated?: AIGeneratedData | null
	artifactActivationPending?: boolean
}

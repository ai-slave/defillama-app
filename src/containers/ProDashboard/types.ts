import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
import type { ChartConfig as DownloadChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import type { ChartConfiguration, ChartDataByKey } from '~/containers/LlamaAI/chartTypes'
import type { RWAChartMetricKey, RWAOverviewBreakdownRequest } from '~/containers/RWA/api.types'
import type { StoredColSpan } from './dashboardConfig/colSpan'

const dashboardBlue = '#326abd'

export type DashboardGrouping = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface Chain {
	gecko_id: string | null
	tvl: number
	tokenSymbol: string | null
	name: string
	chainId: number | string | null
	cmcId: string | null
}

export interface MultiChartConfig {
	id: string
	kind: 'multi'
	name?: string
	items: Array<ChartConfig>
	grouping?: DashboardGrouping
	colSpan?: StoredColSpan
	showCumulative?: boolean
	showPercentage?: boolean
	showStacked?: boolean
	showTreemap?: boolean
}

export const MAX_MULTI_CHART_SERIES = 20

export interface TextConfig {
	id: string
	kind: 'text'
	title?: string
	content: string
	colSpan?: StoredColSpan
	allowHtml?: boolean
}

export type MetricAggregator =
	| 'latest'
	| 'avg'
	| 'max'
	| 'min'
	| 'sum'
	| 'median'
	| 'stddev'
	| 'first'
	| 'growth'
	| 'movingavg'
export type MetricWindow = '7d' | '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all'

export type MetricChartType = 'sparkline' | 'bar' | 'none'

export type MetricSubject =
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

export type ProtocolChartType = (typeof PROTOCOL_CHART_TYPES)[number]
export type ChainChartType = (typeof CHAIN_CHART_TYPES)[number]

interface MetricConfigBase<Type extends ProDashboardChartType, Subject extends MetricSubject> {
	id: string
	kind: 'metric'
	subject: Subject
	type: Type
	aggregator: MetricAggregator
	window: MetricWindow
	compare?: {
		mode: 'previous_window' | 'previous_value' | 'none'
		format?: 'percent' | 'absolute'
	}
	chartType: MetricChartType
	label?: string
	format?: {
		value?: 'currency' | 'number' | 'percent' | 'auto'
		decimals?: number
		compact?: boolean
	}
	colSpan?: StoredColSpan
}

export type MetricConfig =
	| MetricConfigBase<ChainChartType, Extract<MetricSubject, { itemType: 'chain' }>>
	| MetricConfigBase<ProtocolChartType, Extract<MetricSubject, { itemType: 'protocol' }>>

export interface ChartBuilderConfig {
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
		chainFilterMode: 'include' | 'exclude'
		categoryFilterMode: 'include' | 'exclude'
		chainCategoryFilterMode: 'include' | 'exclude'
		protocolCategoryFilterMode: 'include' | 'exclude'
		protocol?: string
		chains: Array<string>
		chainCategories?: Array<string>
		protocolCategories?: Array<string>
		categories: Array<string>
		groupBy: 'protocol'
		limit: number
		chartType: 'stackedBar' | 'stackedArea' | 'line' | 'treemap'
		treemapValue?: 'latest' | 'sum7d' | 'sum30d'
		displayAs: 'timeSeries' | 'percentage'
		hideOthers?: boolean
		groupByParent?: boolean
		seriesColors?: Record<string, string>
	}
	grouping?: DashboardGrouping
	colSpan?: StoredColSpan
}

export type YieldChartType =
	| 'tvl-apy'
	| 'supply-apy'
	| 'supply-apy-7d'
	| 'borrow-apy'
	| 'net-borrow-apy'
	| 'pool-liquidity'

export type ActiveYieldChartType = Exclude<YieldChartType, 'pool-liquidity'>

export function normalizeYieldChartType(chartType: string | undefined): ActiveYieldChartType {
	// V2 borrow history has Borrowed and Available, but not the historical supplied/debt-ceiling
	// facts required by the legacy Pool Liquidity chart. Old saved cards open on Borrow Cost APY.
	if (chartType === 'pool-liquidity') return 'borrow-apy'
	if (
		chartType === 'supply-apy' ||
		chartType === 'supply-apy-7d' ||
		chartType === 'borrow-apy' ||
		chartType === 'net-borrow-apy'
	)
		return chartType
	return 'tvl-apy'
}

export interface YieldsChartConfig {
	id: string
	kind: 'yields'
	poolConfigId: string
	poolName: string
	project: string
	chain: string
	chartType?: YieldChartType
	colSpan?: StoredColSpan
}

export type StablecoinChartType = 'totalMcap' | 'tokenMcaps' | 'pie' | 'dominance' | 'usdInflows' | 'tokenInflows'

export interface StablecoinsChartConfig {
	id: string
	kind: 'stablecoins'
	chain: string
	chartType: StablecoinChartType
	colSpan?: StoredColSpan
}

export type StablecoinAssetChartType = 'totalCirc' | 'chainMcaps' | 'chainPie' | 'chainDominance'

export interface StablecoinAssetChartConfig {
	id: string
	kind: 'stablecoin-asset'
	stablecoin: string
	stablecoinId: string
	chartType: StablecoinAssetChartType
	colSpan?: StoredColSpan
}

export type AdvancedTvlChartType =
	| 'tvl'
	| 'chainsTvl'
	| 'tokenValuesUsd'
	| 'tokensPie'
	| 'tokenBalances'
	| 'usdInflows'
	| 'tokenInflows'

export interface AdvancedTvlChartConfig {
	id: string
	kind: 'advanced-tvl'
	protocol: string
	protocolName: string
	chartType: AdvancedTvlChartType
	colSpan?: StoredColSpan
}

export type BorrowedChartType = 'chainsBorrowed' | 'tokenBorrowedUsd' | 'tokensBorrowedPie' | 'tokenBorrowedRaw'

export interface BorrowedChartConfig {
	id: string
	kind: 'advanced-borrowed'
	protocol: string
	protocolName: string
	chartType: BorrowedChartType
	colSpan?: StoredColSpan
}

export interface IncomeStatementConfig {
	id: string
	kind: 'income-statement'
	protocol: string
	protocolName: string
	colSpan?: StoredColSpan
}

export interface LlamaAIChartConfig {
	id: string
	kind: 'llamaai-chart'
	savedChartId?: string
	chartRef?: string
	artifactId?: string | null
	artifactVersionId?: string | null
	pinnedVersionId?: string
	artifactStatus?: 'live' | 'snapshot-only' | 'needs-repair'
	artifactReasonCode?: string
	artifactContainsPremium?: boolean
	artifactEstimatedMaxCostUsd?: number
	title?: string
	inlineChartConfig?: ChartConfiguration
	inlineChartData?: ChartDataByKey
	colSpan?: StoredColSpan
}

export type UnlocksDataType = 'documented' | 'realtime'

export interface UnlocksScheduleConfig {
	id: string
	kind: 'unlocks-schedule'
	protocol: string
	protocolName: string
	dataType: UnlocksDataType
	colSpan?: StoredColSpan
}

type UnlocksPieChartType = 'allocation' | 'locked-unlocked'

export interface UnlocksPieConfig {
	id: string
	kind: 'unlocks-pie'
	protocol: string
	protocolName: string
	chartType: UnlocksPieChartType
	colSpan?: StoredColSpan
}

export type RWAOverviewChartView = 'timeSeries' | 'pie' | 'treemap' | 'hbar'
export type RWAOverviewChartMetric = RWAChartMetricKey
export type RWAOverviewChartBreakdown = RWAOverviewBreakdownRequest['breakdown']

export interface RWAOverviewChartConfig {
	id: string
	kind: 'rwa-overview'
	metric: RWAOverviewChartMetric
	chartView: RWAOverviewChartView
	breakdown: RWAOverviewChartBreakdown
	chain?: string
	treemapNestedBy?: string
	colSpan?: StoredColSpan
}

export interface RWAAssetChartConfig {
	id: string
	kind: 'rwa-asset'
	assetId: string
	assetName: string
	metrics: Array<RWAOverviewChartMetric>
	colSpan?: StoredColSpan
}

export type SqlSnapshotValue =
	| string
	| number
	| boolean
	| null
	| Array<SqlSnapshotValue>
	| { [key: string]: SqlSnapshotValue }

export interface SqlSnapshot {
	columns: Array<{ name: string; type: string }>
	/** New snapshots are positional; object rows remain readable for persisted legacy snapshots. */
	rows: Array<Array<SqlSnapshotValue>> | Array<Record<string, SqlSnapshotValue>>
	computedAt: string
	rowCount: number
	truncated?: boolean
	engine: 'browser' | 'server'
}

export interface SqlQueryRecipe {
	sql: string
	tableSources: Array<TableSource>
}

export interface SqlChartConfig {
	id: string
	kind: 'sql'
	name?: string
	query: SqlQueryRecipe
	chart: DownloadChartConfig
	displayMode?: 'chart' | 'table'
	rowCap?: number
	snapshot?: SqlSnapshot | null
	colSpan?: StoredColSpan
}

interface ChartConfigBase<Type extends ProDashboardChartType> {
	id: string
	kind: 'chart'
	type: Type
	color?: string
	grouping?: DashboardGrouping
	geckoId?: string | null
	dataType?: UnlocksDataType
	colSpan?: StoredColSpan
	showCumulative?: boolean
}

export type ChartSubject =
	| { subjectType: 'chain'; chain: string; protocol?: never }
	| { subjectType: 'protocol'; protocol: string; chain?: never }

export type ChartConfig =
	| (ChartConfigBase<ChainChartType> & Extract<ChartSubject, { subjectType: 'chain' }>)
	| (ChartConfigBase<ProtocolChartType> & Extract<ChartSubject, { subjectType: 'protocol' }>)

export function limitMultiChartItems(items: Array<ChartConfig>): Array<ChartConfig> {
	return items.length > MAX_MULTI_CHART_SERIES ? items.slice(0, MAX_MULTI_CHART_SERIES) : items
}

interface DatasetTableConfigBase {
	id: string
	kind: 'dataset-table'
	colSpan?: StoredColSpan
}

export interface YieldsFilters {
	apyMin?: number
	apyMax?: number
	tvlMin?: number
	tvlMax?: number
	baseApyMin?: number
	baseApyMax?: number
	chains?: Array<string>
	protocols?: Array<string>
	tokens?: Array<string>
	hasRewards?: boolean
	stablesOnly?: boolean
	categories?: Array<string>
}

export interface StablecoinsDatasetTableConfig extends DatasetTableConfigBase {
	datasetType: 'stablecoins'
	chain: string
}

type CexSnapshotView = Exclude<CexAnalyticsView, 'market-share'>

export type CexDatasetTableConfig =
	| (DatasetTableConfigBase & {
			datasetType: 'cex-analytics'
			cexAnalyticsView: CexSnapshotView
	  })
	| (DatasetTableConfigBase & {
			datasetType: 'cex-analytics'
			cexAnalyticsView: 'market-share'
			cexAnalyticsMetric: CexAnalyticsMetric
			cexAnalyticsTopN: number
	  })

export interface TokenUsageDatasetTableConfig extends DatasetTableConfigBase {
	datasetType: 'token-usage'
	tokenSymbols: Array<string>
	includeCex: boolean
}

export interface YieldsDatasetTableConfig extends DatasetTableConfigBase {
	datasetType: 'yields'
	chains: Array<string>
	filters?: YieldsFilters
	columnOrder?: Array<string>
	columnVisibility?: Record<string, boolean>
}

export interface ChainsDatasetTableConfig extends DatasetTableConfigBase {
	datasetType: 'chains'
	category?: string
	columnOrder?: Array<string>
	columnVisibility?: Record<string, boolean>
}

export type RwaDatasetTableConfig =
	| (DatasetTableConfigBase & { datasetType: 'rwa' })
	| (DatasetTableConfigBase & { datasetType: 'rwa-chains' })
	| (DatasetTableConfigBase & {
			datasetType: 'rwa-selected-chain'
			chain: string
	  })

export type EquitiesDatasetTableConfig =
	| (DatasetTableConfigBase & { datasetType: 'equities' })
	| (DatasetTableConfigBase & {
			datasetType: 'equities-financials'
			ticker: string
	  })
	| (DatasetTableConfigBase & {
			datasetType: 'equities-filings'
			ticker: string
	  })

export type DatasetTableConfig =
	| StablecoinsDatasetTableConfig
	| CexDatasetTableConfig
	| TokenUsageDatasetTableConfig
	| YieldsDatasetTableConfig
	| ChainsDatasetTableConfig
	| RwaDatasetTableConfig
	| EquitiesDatasetTableConfig

export interface Protocol {
	id: string
	name: string
	symbol?: string
	logo?: string
	slug: string
	tvl: number
	chains: Array<string>
	listedAt?: number
	deprecated?: boolean
	geckoId?: string | null
	parentProtocol?: string | null
	category?: string
	misrepresentedTokens?: boolean
}

export const CHART_TYPES = {
	tvl: { id: 'tvl', title: 'TVL', chartType: 'area', color: dashboardBlue },
	volume: {
		id: 'volume',
		title: 'Volume',
		chartType: 'bar',
		color: '#46c385',
		groupable: true
	},
	fees: {
		id: 'fees',
		title: 'Fees',
		chartType: 'bar',
		color: '#cc803e',
		groupable: true
	},
	txs: {
		id: 'txs',
		title: 'Transactions',
		chartType: 'bar',
		color: '#cc533e',
		groupable: true
	},
	revenue: {
		id: 'revenue',
		title: 'Revenue',
		chartType: 'bar',
		color: '#cb8e3a',
		groupable: true
	},
	incentives: {
		id: 'incentives',
		title: 'Incentives',
		chartType: 'bar',
		color: '#2a9d77',
		groupable: true
	},
	unlocks: {
		id: 'unlocks',
		title: 'Unlocks',
		chartType: 'line',
		color: '#3e6dcc'
	},
	treasury: {
		id: 'treasury',
		title: 'Treasury',
		chartType: 'area',
		color: '#65758b'
	},
	aggregators: {
		id: 'aggregators',
		title: 'DEX Aggregators Volume',
		chartType: 'bar',
		color: '#c98c36',
		groupable: true
	},
	perps: {
		id: 'perps',
		title: 'Perps Volume',
		chartType: 'bar',
		color: '#a92d2d',
		groupable: true
	},
	bridgeAggregators: {
		id: 'bridgeAggregators',
		title: 'Bridge Aggregators Volume',
		chartType: 'bar',
		color: '#7b2c90',
		groupable: true
	},
	perpsAggregators: {
		id: 'perpsAggregators',
		title: 'Perps Aggregators Volume',
		chartType: 'bar',
		color: '#cb3a3a',
		groupable: true
	},
	holdersRevenue: {
		id: 'holdersRevenue',
		title: 'Holders Revenue',
		chartType: 'bar',
		color: '#778192',
		groupable: true
	},
	openInterest: {
		id: 'openInterest',
		title: 'Open Interest',
		chartType: 'area',
		color: '#3394c1'
	},
	optionsPremium: {
		id: 'optionsPremium',
		title: 'Options Premium Volume',
		chartType: 'bar',
		color: '#cc3e87',
		groupable: true
	},
	optionsNotional: {
		id: 'optionsNotional',
		title: 'Options Notional Volume',
		chartType: 'bar',
		color: '#cc3e53',
		groupable: true
	},
	tokenPrice: {
		id: 'tokenPrice',
		title: 'Token Price',
		chartType: 'area',
		color: '#27914e'
	},
	tokenMcap: {
		id: 'tokenMcap',
		title: 'Token Market Cap',
		chartType: 'area',
		color: '#426ecd'
	},
	tokenVolume: {
		id: 'tokenVolume',
		title: 'Token Volume',
		chartType: 'bar',
		color: '#c99336',
		groupable: true
	},
	activeUsers: {
		id: 'activeUsers',
		title: 'Active Addresses',
		chartType: 'bar',
		color: '#cc3e85',
		groupable: true
	},
	newUsers: {
		id: 'newUsers',
		title: 'New Addresses',
		chartType: 'bar',
		color: '#683ecc',
		groupable: true
	},
	gasUsed: {
		id: 'gasUsed',
		title: 'Gas Used',
		chartType: 'bar',
		color: '#c99336',
		groupable: true
	},
	medianApy: {
		id: 'medianApy',
		title: 'Median APY',
		chartType: 'area',
		color: '#299976'
	},
	stablecoins: {
		id: 'stablecoins',
		title: 'Stablecoins',
		chartType: 'area',
		color: '#2e9aad'
	},
	stablecoinInflows: {
		id: 'stablecoinInflows',
		title: 'Stablecoin Inflows',
		chartType: 'bar',
		color: '#c99336',
		groupable: true
	},
	chainFees: {
		id: 'chainFees',
		title: 'Chain Fees',
		chartType: 'bar',
		color: '#c99336',
		groupable: true
	},
	chainRevenue: {
		id: 'chainRevenue',
		title: 'Chain Revenue',
		chartType: 'bar',
		color: '#c99336',
		groupable: true
	},
	bridgedTvl: {
		id: 'bridgedTvl',
		title: 'Bridged TVL',
		chartType: 'area',
		color: '#873ecc'
	},
	chainMcap: {
		id: 'chainMcap',
		title: 'Native Token Market Cap',
		chartType: 'area',
		color: '#426ecd'
	},
	chainPrice: {
		id: 'chainPrice',
		title: 'Native Token Price',
		chartType: 'area',
		color: '#27914e'
	},
	borrowed: {
		id: 'borrowed',
		title: 'Borrowed',
		chartType: 'area',
		color: '#cc3e3e'
	},
	pfRatio: {
		id: 'pfRatio',
		title: 'P/F Ratio (30d Run Rate)',
		chartType: 'line',
		color: '#683ecc'
	},
	psRatio: {
		id: 'psRatio',
		title: 'P/S Ratio (30d Run Rate)',
		chartType: 'line',
		color: '#2e9aad'
	}
}

export type ProDashboardChartType = keyof typeof CHART_TYPES

/** Draft and persisted inputs are unvalidated strings, so narrow them before constructing current config. */
export function isProDashboardChartType(type: string): type is ProDashboardChartType {
	return Object.hasOwn(CHART_TYPES, type)
}

export function getProDashboardChartTypeConfig(type: string) {
	return isProDashboardChartType(type) ? CHART_TYPES[type] : undefined
}

export const PROTOCOL_CHART_TYPES = [
	'tvl',
	'volume',
	'fees',
	'revenue',
	'unlocks',
	'incentives',
	'treasury',
	'holdersRevenue',
	'perps',
	'openInterest',
	'aggregators',
	'perpsAggregators',
	'bridgeAggregators',
	'optionsPremium',
	'optionsNotional',
	'activeUsers',
	'newUsers',
	'txs',
	'gasUsed',
	'tokenMcap',
	'tokenPrice',
	'tokenVolume',
	'medianApy',
	'borrowed',
	'pfRatio',
	'psRatio'
] as const satisfies ReadonlyArray<ProDashboardChartType>

export const CHAIN_CHART_TYPES = [
	'tvl',
	'volume',
	'fees',
	'txs',
	'aggregators',
	'perps',
	'openInterest',
	'bridgeAggregators',
	'perpsAggregators',
	'optionsPremium',
	'optionsNotional',
	'revenue',
	'activeUsers',
	'newUsers',
	'gasUsed',
	'stablecoins',
	'stablecoinInflows',
	'chainFees',
	'chainRevenue',
	'bridgedTvl',
	'chainMcap',
	'chainPrice'
] as const satisfies ReadonlyArray<ProDashboardChartType>

const PROTOCOL_CHART_TYPE_SET: ReadonlySet<string> = new Set(PROTOCOL_CHART_TYPES)
const CHAIN_CHART_TYPE_SET: ReadonlySet<string> = new Set(CHAIN_CHART_TYPES)

export function isProtocolDashboardChartType(type: string): type is ProtocolChartType {
	return PROTOCOL_CHART_TYPE_SET.has(type)
}

export function isChainDashboardChartType(type: string): type is ChainChartType {
	return CHAIN_CHART_TYPE_SET.has(type)
}

export function isDashboardChartTypeForSubject(subjectType: 'chain' | 'protocol', type: string) {
	return subjectType === 'chain' ? isChainDashboardChartType(type) : isProtocolDashboardChartType(type)
}

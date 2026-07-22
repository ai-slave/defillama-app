import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
export type {
	CexAnalyticsMarketSharePoint,
	CexAnalyticsMetric,
	CexAnalyticsSnapshotResponse,
	CexAnalyticsSnapshotRow,
	CexAnalyticsSummary,
	CexAnalyticsTotalsPoint,
	CexAnalyticsView
} from '~/containers/Cexs/api.types'

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

export type StoredColSpan = 0.5 | 1 | 1.5 | 2

export interface MultiChartConfig {
	id: string
	kind: 'multi'
	name?: string
	items: ChartConfig[]
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

export interface MetricConfig {
	id: string
	kind: 'metric'
	subject: {
		itemType: 'chain' | 'protocol'
		chain?: string
		protocol?: string
		geckoId?: string | null
	}
	type: string
	aggregator: MetricAggregator
	window: MetricWindow
	compare?: {
		mode: 'previous_window' | 'previous_value' | 'none'
		format?: 'percent' | 'absolute'
	}
	showSparkline?: boolean // deprecated, use chartType
	chartType?: MetricChartType
	label?: string
	format?: {
		value?: 'currency' | 'number' | 'percent' | 'auto'
		decimals?: number
		compact?: boolean
	}
	colSpan?: StoredColSpan
}

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
		additionalFilters?: Record<string, unknown>
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
	title?: string
	inlineChartConfig?: import('~/containers/LlamaAI/types').ChartConfiguration
	inlineChartData?: Record<string, any[]>
	colSpan?: StoredColSpan
}

export type UnifiedRowHeaderType = 'parent-protocol' | 'protocol' | 'chain' | 'category'

type UnlocksDataType = 'documented' | 'realtime'

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
export type RWAOverviewChartMetric = 'activeMcap' | 'onChainMcap' | 'defiActiveTvl'
export type RWAOverviewChartBreakdown = 'chain' | 'category' | 'assetClass' | 'assetName' | 'platform' | 'assetGroup'

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
	metrics: RWAOverviewChartMetric[]
	colSpan?: StoredColSpan
}

export interface SqlSnapshot {
	columns: { name: string; type: string }[]
	/** New snapshots are positional; object rows remain readable for persisted legacy snapshots. */
	rows: unknown[][] | Record<string, unknown>[]
	computedAt: string
	rowCount: number
	truncated?: boolean
	engine: 'browser' | 'server'
}

export interface SqlQueryRecipe {
	sql: string
	tableSources: import('~/containers/Downloads/sql/useTableRegistry').TableSource[]
}

export interface SqlChartConfig {
	id: string
	kind: 'sql'
	name?: string
	query: SqlQueryRecipe
	chart: import('~/containers/Downloads/sql/chartConfig').ChartConfig
	displayMode?: 'chart' | 'table'
	rowCap?: number
	snapshot?: SqlSnapshot | null
	colSpan?: StoredColSpan
}

export type DashboardItemConfig =
	| ChartConfig
	| ProtocolsTableConfig
	| MultiChartConfig
	| TextConfig
	| MetricConfig
	| ChartBuilderConfig
	| YieldsChartConfig
	| StablecoinsChartConfig
	| StablecoinAssetChartConfig
	| AdvancedTvlChartConfig
	| BorrowedChartConfig
	| IncomeStatementConfig
	| UnlocksScheduleConfig
	| UnlocksPieConfig
	| UnifiedTableConfig
	| LlamaAIChartConfig
	| RWAOverviewChartConfig
	| RWAAssetChartConfig
	| SqlChartConfig

export interface ChartConfig {
	id: string
	kind: 'chart'
	chain: string
	protocol?: string
	type: string
	color?: string
	/** Strictly ascending, unique Unix-second points returned by the dashboard query layer. */
	data?: [number, number][]
	isLoading?: boolean
	hasError?: boolean
	refetch?: () => void
	grouping?: DashboardGrouping
	geckoId?: string | null
	dataType?: UnlocksDataType
	colSpan?: StoredColSpan
	showCumulative?: boolean
}

export function limitMultiChartItems(items: ChartConfig[]): ChartConfig[] {
	return items.length > MAX_MULTI_CHART_SERIES ? items.slice(0, MAX_MULTI_CHART_SERIES) : items
}

export interface TableFilters {
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
	[key: string]: any // Allow for future filter types
}

export interface CustomView {
	id: string
	name: string
	columnOrder: string[]
	columnVisibility: Record<string, boolean>
	customColumns?: Array<{
		id: string
		name: string
		expression: string
		isValid: boolean
		errorMessage?: string
	}>
	createdAt: number
}

export interface ProtocolsTableConfig {
	id: string
	kind: 'table'
	tableType: 'protocols' | 'dataset'
	chains: string[]
	colSpan?: StoredColSpan
	filters?: TableFilters
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	customColumns?: Array<{
		id: string
		name: string
		expression: string
		isValid: boolean
		errorMessage?: string
	}>
	activeViewId?: string
	activePresetId?: string
	datasetType?:
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
		| 'trending-contracts'
		| 'chains'
		| 'rwa'
		| 'rwa-chains'
		| 'rwa-selected-chain'
		| 'equities'
		| 'equities-financials'
		| 'equities-filings'
	datasetChain?: string
	tokenSymbols?: string[]
	includeCex?: boolean
	datasetTimeframe?: string
	cexAnalyticsView?: CexAnalyticsView
	cexAnalyticsMetric?: CexAnalyticsMetric
	cexAnalyticsTopN?: number
}

export interface CustomColumnDefinition {
	id: string
	name: string
	expression: string
	format: 'usd' | 'percent' | 'ratio' | 'number'
	aggregation: 'sum' | 'first' | 'none' | 'recalculate'
}

export interface UnifiedTableConfig {
	id: string
	kind: 'unified-table'
	rowHeaders: UnifiedRowHeaderType[]
	defaultSorting?: Array<{ id: string; desc: boolean }>
	params?: {
		chains?: string[]
		category?: string | null
		[key: string]: any
	} | null
	filters?: TableFilters
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	activePresetId?: string
	colSpan?: StoredColSpan
	customColumns?: CustomColumnDefinition[]
}

export interface Protocol {
	id: string
	name: string
	symbol?: string
	logo?: string
	slug: string
	tvl: number
	geckoId?: string | null
	parentProtocol?: string | null
	category?: string
	misrepresentedTokens?: boolean
}

export const CHART_TYPES = {
	tvl: { id: 'tvl', title: 'TVL', chartType: 'area', color: dashboardBlue },
	volume: { id: 'volume', title: 'Volume', chartType: 'bar', color: '#46c385', groupable: true },
	fees: { id: 'fees', title: 'Fees', chartType: 'bar', color: '#cc803e', groupable: true },
	users: { id: 'users', title: 'Users', chartType: 'bar', color: '#8942cd', groupable: true },
	txs: { id: 'txs', title: 'Transactions', chartType: 'bar', color: '#cc533e', groupable: true },
	options: { id: 'options', title: 'Options Premium Volume', chartType: 'bar', color: '#cc3e87', groupable: true },
	revenue: { id: 'revenue', title: 'Revenue', chartType: 'bar', color: '#cb8e3a', groupable: true },
	incentives: { id: 'incentives', title: 'Incentives', chartType: 'bar', color: '#2a9d77', groupable: true },
	unlocks: { id: 'unlocks', title: 'Unlocks', chartType: 'line', color: '#3e6dcc' },
	liquidity: { id: 'liquidity', title: 'Liquidity', chartType: 'area', color: '#3394c1' },
	treasury: { id: 'treasury', title: 'Treasury', chartType: 'area', color: '#65758b' },
	aggregators: {
		id: 'aggregators',
		title: 'DEX Aggregators Volume',
		chartType: 'bar',
		color: '#c98c36',
		groupable: true
	},
	perps: { id: 'perps', title: 'Perps Volume', chartType: 'bar', color: '#a92d2d', groupable: true },
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
	bribes: { id: 'bribes', title: 'Bribes Revenue', chartType: 'bar', color: '#299976', groupable: true },
	tokenTax: { id: 'tokenTax', title: 'Token Tax', chartType: 'bar', color: '#723ecc', groupable: true },
	holdersRevenue: {
		id: 'holdersRevenue',
		title: 'Holders Revenue',
		chartType: 'bar',
		color: '#778192',
		groupable: true
	},
	openInterest: { id: 'openInterest', title: 'Open Interest', chartType: 'area', color: '#3394c1' },
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
	tokenPrice: { id: 'tokenPrice', title: 'Token Price', chartType: 'area', color: '#27914e' },
	tokenMcap: { id: 'tokenMcap', title: 'Token Market Cap', chartType: 'area', color: '#426ecd' },
	tokenVolume: { id: 'tokenVolume', title: 'Token Volume', chartType: 'bar', color: '#c99336', groupable: true },
	activeUsers: { id: 'activeUsers', title: 'Active Addresses', chartType: 'bar', color: '#cc3e85', groupable: true },
	newUsers: { id: 'newUsers', title: 'New Addresses', chartType: 'bar', color: '#683ecc', groupable: true },
	gasUsed: { id: 'gasUsed', title: 'Gas Used', chartType: 'bar', color: '#c99336', groupable: true },
	medianApy: { id: 'medianApy', title: 'Median APY', chartType: 'area', color: '#299976' },
	stablecoins: { id: 'stablecoins', title: 'Stablecoins', chartType: 'area', color: '#2e9aad' },
	stablecoinInflows: {
		id: 'stablecoinInflows',
		title: 'Stablecoin Inflows',
		chartType: 'bar',
		color: '#c99336',
		groupable: true
	},
	chainFees: { id: 'chainFees', title: 'Chain Fees', chartType: 'bar', color: '#c99336', groupable: true },
	chainRevenue: { id: 'chainRevenue', title: 'Chain Revenue', chartType: 'bar', color: '#c99336', groupable: true },
	bridgedTvl: { id: 'bridgedTvl', title: 'Bridged TVL', chartType: 'area', color: '#873ecc' },
	chainMcap: { id: 'chainMcap', title: 'Native Token Market Cap', chartType: 'area', color: '#426ecd' },
	chainPrice: { id: 'chainPrice', title: 'Native Token Price', chartType: 'area', color: '#27914e' },
	borrowed: { id: 'borrowed', title: 'Borrowed', chartType: 'area', color: '#cc3e3e' },
	pfRatio: { id: 'pfRatio', title: 'P/F Ratio (30d Run Rate)', chartType: 'line', color: '#683ecc' },
	psRatio: { id: 'psRatio', title: 'P/S Ratio (30d Run Rate)', chartType: 'line', color: '#2e9aad' }
}

export type ProDashboardChartType = keyof typeof CHART_TYPES

/** Saved dashboards are unvalidated JSON, so narrow chart types at the lookup boundary. */
export function isProDashboardChartType(type: string): type is ProDashboardChartType {
	return Object.hasOwn(CHART_TYPES, type)
}

export function getProDashboardChartTypeConfig(type: string) {
	return isProDashboardChartType(type) ? CHART_TYPES[type] : undefined
}

// Helper functions to extract chart types from CHART_TYPES
export const getProtocolChartTypes = (): string[] => {
	return [
		'tvl',
		'volume',
		'fees',
		'revenue',
		'unlocks',
		'incentives',
		'treasury',
		'holdersRevenue',
		'bribes',
		'tokenTax',
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
	]
}

export const getChainChartTypes = (): string[] => {
	return [
		'tvl',
		'volume',
		'fees',
		'users',
		'txs',
		'aggregators',
		'perps',
		'bridgeAggregators',
		'perpsAggregators',
		'optionsPremium',
		'optionsNotional',
		'revenue',
		'bribes',
		'tokenTax',
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
	]
}

interface BaseDatasetItem {
	id: string
	name: string
	slug?: string
	logo?: string
	category?: string
	chains?: string[]
	total24h?: number
	total7d?: number
	total30d?: number
	totalAllTime?: number
	change_1d?: number
	change_7d?: number
}

export interface DexItem extends BaseDatasetItem {
	childProtocols?: Array<{
		name: string
		slug: string
		logo?: string
		chains?: string[]
		category?: string
		total24h?: number
		total7d?: number
		total30d?: number
		total1y?: number
		totalAllTime?: number
		mcap?: number | null
	}>
}

// oxlint-disable-next-line typescript/no-empty-object-type
export interface AggregatorItem extends BaseDatasetItem {}

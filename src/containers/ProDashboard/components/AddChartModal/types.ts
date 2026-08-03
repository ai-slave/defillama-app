import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type {
	ChartBuilderConfig as StoredChartBuilderConfig,
	AdvancedTvlChartType,
	BorrowedChartType,
	ChartConfig,
	MetricAggregator,
	MetricChartType,
	RWAOverviewChartBreakdown,
	RWAOverviewChartMetric,
	RWAOverviewChartView,
	StablecoinAssetChartType,
	StablecoinChartType,
	YieldChartType
} from '../../types'
import type { UnifiedTableFocusSection } from '../UnifiedTable/types'

export interface AddChartModalProps {
	isOpen: boolean
	onClose: () => void
	editItem?: DashboardItemConfig | null | undefined
	initialUnifiedFocusSection?: UnifiedTableFocusSection | undefined
	onOpenSqlModal?: () => void
}

export type MainTabType = 'charts' | 'metric' | 'table' | 'text' | 'llamaai' | 'sql'
export type ChartModeType = 'manual' | 'builder'
export type ChartTabType =
	| 'chain'
	| 'protocol'
	| 'yields'
	| 'stablecoins'
	| 'advanced-tvl'
	| 'borrowed'
	| 'income-statement'
	| 'unlocks'
	| 'rwa'
export type ManualChartViewMode = 'cards' | 'form'
export type CombinedTableType =
	| 'protocols'
	| 'cex'
	| 'cex-analytics'
	| 'stablecoins'
	| 'token-usage'
	| 'yields'
	| 'chains'
	| 'rwa'
	| 'rwa-chains'
	| 'rwa-selected-chain'
	| 'equities'
	| 'equities-financials'
	| 'equities-filings'

export type ChartBuilderConfig = StoredChartBuilderConfig['config']
export type ChartBuilderUpdate = Omit<Partial<ChartBuilderConfig>, 'protocol' | 'protocolCategories'> & {
	protocol?: string | undefined
	protocolCategories?: string[] | undefined
}

export interface ModalState {
	selectedMainTab: MainTabType
	selectedChartTab: ChartTabType
	chartMode: ChartModeType
	composerItems: ChartConfig[]
	selectedChain: string | null
	selectedChains: string[]
	selectedProtocols: string[]
	selectedProtocol: string | null
	selectedChartType: string
	selectedChartTypes: string[]
	unifiedChartName: string
	chartCreationMode: 'separate' | 'combined'
	textTitle: string
	textContent: string
	selectedTableType: CombinedTableType
	selectedDatasetChain: string | null
	selectedCexAnalyticsView: CexAnalyticsView | 'starter'
	selectedCexAnalyticsMetric: CexAnalyticsMetric
	selectedCexAnalyticsTopN: number
	selectedTokens: string[]
	includeCex: boolean
	chartBuilderName: string
	chartBuilder: ChartBuilderConfig
	metricSubjectType: 'chain' | 'protocol'
	metricChain: string | null
	metricProtocol: string | null
	metricType: string
	metricAggregator: MetricAggregator
	metricWindow: '7d' | '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all'
	metricLabel: string
	metricChartType: MetricChartType
	selectedYieldPool: { configID: string; name: string; project: string; chain: string } | null
	selectedYieldChartType: YieldChartType
	selectedYieldChains: string[]
	selectedYieldProjects: string[]
	selectedYieldCategories: string[]
	selectedYieldTokens: string[]
	minTvl: number | null
	maxTvl: number | null
	selectedStablecoinChain: string
	selectedStablecoinChartType: StablecoinChartType
	stablecoinMode: 'chain' | 'asset'
	selectedStablecoinAsset: string | null
	selectedStablecoinAssetId: string | null
	selectedStablecoinAssetChartType: StablecoinAssetChartType
	selectedAdvancedTvlProtocol: string | null
	selectedAdvancedTvlProtocolName: string | null
	selectedAdvancedTvlChartType: AdvancedTvlChartType
	selectedBorrowedProtocol: string | null
	selectedBorrowedProtocolName: string | null
	selectedBorrowedChartType: BorrowedChartType
	selectedIncomeStatementProtocol: string | null
	selectedIncomeStatementProtocolName: string | null
	selectedLlamaAIChart: { id: string; title: string } | null
	selectedUnlocksProtocol: string | null
	selectedUnlocksProtocolName: string | null
	selectedUnlocksChartType: 'total' | 'schedule' | 'allocation' | 'locked-unlocked'
	rwaMode: 'overview' | 'asset'
	selectedRwaChain: string
	selectedRwaMetric: RWAOverviewChartMetric
	selectedRwaChartView: RWAOverviewChartView
	selectedRwaBreakdown: RWAOverviewChartBreakdown
	selectedRwaTreemapNestedBy: string
	selectedRwaAssetId: string | null
	selectedRwaAssetName: string | null
	selectedRwaAssetMetrics: RWAOverviewChartMetric[]
}

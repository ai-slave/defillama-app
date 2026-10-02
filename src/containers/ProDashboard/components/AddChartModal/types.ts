import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
import type { ChartConfig as DownloadChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type {
	ChartBuilderConfig as StoredChartBuilderConfig,
	AdvancedTvlChartType,
	BorrowedChartType,
	ChartConfig,
	CustomDataColumn,
	CustomDataRows,
	DashboardItemBindings,
	MetricAggregator,
	MetricChartType,
	RWAOverviewChartBreakdown,
	RWAOverviewChartMetric,
	RWAOverviewChartView,
	SqlSnapshotValue,
	StablecoinAssetChartType,
	StablecoinChartType,
	YieldChartType
} from '../../types'
import type { DashboardItemPlacement } from '../../useDashboardActions'
import type { UnifiedTableFocusSection } from '../UnifiedTable/types'

export interface AddChartModalProps {
	isOpen: boolean
	onClose: () => void
	onClosed?: () => void
	editItem?: DashboardItemConfig | null | undefined
	draftItem?: DashboardItemConfig
	initialUnifiedFocusSection?: UnifiedTableFocusSection | undefined
	onOpenSqlModal?: () => void
	placement?: DashboardItemPlacement | undefined
}

export type MainTabType = 'charts' | 'metric' | 'table' | 'text' | 'llamaai' | 'sql' | 'custom-data'
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
	protocolCategories?: Array<string> | undefined
}

export interface CustomDataModalState {
	name: string
	sourceName: string
	csvText: string
	columns: Array<CustomDataColumn>
	previewRows: Array<Array<SqlSnapshotValue>> | null
	storedRows: CustomDataRows | null
	chart: DownloadChartConfig
	displayMode: 'chart' | 'table'
	error: string
	isPreparing: boolean
}

export interface ModalState {
	selectedMainTab: MainTabType
	selectedChartTab: ChartTabType
	chartMode: ChartModeType
	manualFormOpen: boolean
	composerItems: Array<ChartConfig>
	bindings: DashboardItemBindings
	customData: CustomDataModalState
	selectedChain: string | null
	selectedChains: Array<string>
	selectedProtocols: Array<string>
	selectedProtocol: string | null
	selectedChartType: string
	selectedChartTypes: Array<string>
	unifiedChartName: string
	chartCreationMode: 'separate' | 'combined'
	textTitle: string
	textContent: string
	/** null until the reader picks a table type; the Table tab opens on the type selector. */
	selectedTableType: CombinedTableType | null
	selectedDatasetChain: string | null
	selectedCexAnalyticsView: CexAnalyticsView | 'starter'
	selectedCexAnalyticsMetric: CexAnalyticsMetric
	selectedCexAnalyticsTopN: number
	selectedTokens: Array<string>
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
	selectedYieldChains: Array<string>
	selectedYieldProjects: Array<string>
	selectedYieldCategories: Array<string>
	selectedYieldTokens: Array<string>
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
	selectedRwaAssetMetrics: Array<RWAOverviewChartMetric>
}

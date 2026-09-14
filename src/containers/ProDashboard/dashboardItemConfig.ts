import type {
	AdvancedTvlChartConfig,
	BorrowedChartConfig,
	ChartBuilderConfig,
	ChartConfig,
	CustomDataConfig,
	DatasetTableConfig,
	IncomeStatementConfig,
	LlamaAIChartConfig,
	MetricConfig,
	MultiChartConfig,
	RWAAssetChartConfig,
	RWAOverviewChartConfig,
	SectionConfig,
	SqlChartConfig,
	StablecoinAssetChartConfig,
	StablecoinsChartConfig,
	TextConfig,
	UnlocksPieConfig,
	UnlocksScheduleConfig,
	YieldsChartConfig
} from './types'
import type { UnifiedTableConfig } from './unifiedTable/config/current'

export type DashboardItemConfig =
	| ChartConfig
	| DatasetTableConfig
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
	| SectionConfig
	| CustomDataConfig

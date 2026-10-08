import type { ChartArtifactRef } from '~/containers/LlamaAI/types'
import type {
	ChartBuilderConfig,
	MultiChartConfig,
	RWAOverviewChartConfig,
	StablecoinAssetChartConfig,
	StablecoinsChartConfig,
	YieldsChartConfig
} from '~/containers/ProDashboard/types'

export type DashboardChartConfig =
	| MultiChartConfig
	| ChartBuilderConfig
	| YieldsChartConfig
	| StablecoinsChartConfig
	| StablecoinAssetChartConfig
	| RWAOverviewChartConfig

export interface LlamaAIChartInput {
	chartId: string
	title: string
	artifactRef: ChartArtifactRef
}

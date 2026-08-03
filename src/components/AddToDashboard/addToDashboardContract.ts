import type { ChartArtifactRef } from '~/containers/LlamaAI/types'
import type {
	ChartBuilderConfig,
	MultiChartConfig,
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

export interface LlamaAIChartInput {
	chartId: string
	title: string
	artifactRef: ChartArtifactRef
}

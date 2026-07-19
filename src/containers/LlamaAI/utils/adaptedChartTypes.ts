import type { AdaptedLlamaAICartesianChart } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import type { AdaptedHBarChartData } from '~/containers/LlamaAI/utils/chartAdapters/hbar'
import type { AdaptedPieChartData } from '~/containers/LlamaAI/utils/chartAdapters/pie'
import type { AdaptedScatterChartData } from '~/containers/LlamaAI/utils/chartAdapters/scatter'

export type AdaptedChartData =
	| AdaptedLlamaAICartesianChart
	| AdaptedPieChartData
	| AdaptedScatterChartData
	| AdaptedHBarChartData

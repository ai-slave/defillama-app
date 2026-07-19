import type { ChartConfiguration, ChartDataSeries } from '~/containers/LlamaAI/types'
import type { AdaptedChartData } from '~/containers/LlamaAI/utils/adaptedChartTypes'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import { adaptHBarChartData } from '~/containers/LlamaAI/utils/chartAdapters/hbar'
import { adaptPieChartData } from '~/containers/LlamaAI/utils/chartAdapters/pie'
import { adaptScatterChartData } from '~/containers/LlamaAI/utils/chartAdapters/scatter'

export function adaptChartData(config: ChartConfiguration, rawData: ChartDataSeries): AdaptedChartData {
	switch (config.type) {
		case 'pie':
			return adaptPieChartData(config, rawData)
		case 'scatter':
			return adaptScatterChartData(config, rawData)
		case 'hbar':
			return adaptHBarChartData(config, rawData)
		case 'line':
		case 'area':
		case 'bar':
		case 'combo':
			return adaptCartesianChartData(config, rawData)
		default:
			return adaptCartesianChartData(config, rawData)
	}
}

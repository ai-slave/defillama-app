import type * as echarts from 'echarts/core'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { LineBarChart } from './LineBarChart'

interface AreaChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height: string
}

export function AreaChartAdapter({ config, result, classified, onReady, height }: AreaChartAdapterProps) {
	const stackKey = config.chartType === 'areaStacked' || config.chartType === 'areaPct' ? 'area' : undefined
	return (
		<LineBarChart
			config={stackKey ? { ...config, stackMode: config.chartType === 'areaPct' ? 'expand' : 'stacked' } : config}
			result={result}
			classified={classified}
			onReady={onReady}
			height={height}
			forceType="line"
			forceArea
			forceStack={stackKey}
		/>
	)
}

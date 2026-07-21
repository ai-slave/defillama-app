import type * as echarts from 'echarts/core'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { LineBarChart } from './LineBarChart'

interface BarChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: ClassifiedColumn[]
	onReady?: (instance: echarts.ECharts | null) => void
}

export function BarChartAdapter({ config, result, classified, onReady }: BarChartAdapterProps) {
	return (
		<LineBarChart
			config={config}
			result={result}
			classified={classified}
			onReady={onReady}
			forceType="bar"
			forceStack={config.stackMode !== 'off' ? 'bar' : undefined}
		/>
	)
}

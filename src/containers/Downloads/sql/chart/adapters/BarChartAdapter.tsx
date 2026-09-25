import type * as echarts from 'echarts/core'
import type { ChartConfig } from '../../chartConfig'
import type { ClassifiedColumn } from '../../columnKind'
import type { QueryResult } from '../../exportResults'
import { LineBarChart } from './LineBarChart'

interface BarChartAdapterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height: string
}

export function BarChartAdapter({ config, result, classified, onReady, height }: BarChartAdapterProps) {
	return (
		<LineBarChart
			config={config}
			result={result}
			classified={classified}
			onReady={onReady}
			height={height}
			forceType="bar"
			forceStack={config.stackMode !== 'off' ? 'bar' : undefined}
		/>
	)
}

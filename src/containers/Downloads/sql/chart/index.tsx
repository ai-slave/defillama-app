import type * as echarts from 'echarts/core'
import { EmptyState } from '~/ui/Status'
import type { ChartConfig } from '../chartConfig'
import type { ClassifiedColumn } from '../columnKind'
import type { QueryResult } from '../exportResults'
import { AreaChartAdapter } from './adapters/AreaChartAdapter'
import { BubbleChartAdapter } from './adapters/BubbleChartAdapter'
import { CandlestickChartAdapter } from './adapters/CandlestickChartAdapter'
import { HBarChartAdapter } from './adapters/HBarChartAdapter'
import { HistogramChartAdapter } from './adapters/HistogramChartAdapter'
import { LineBarChart } from './adapters/LineBarChart'
import { PieChartAdapter } from './adapters/PieChartAdapter'
import { ScatterChartAdapter } from './adapters/ScatterChartAdapter'
import { TreemapChartAdapter } from './adapters/TreemapChartAdapter'
import { SQL_CHART_HEIGHT } from './chartLayout'

interface ChartRouterProps {
	config: ChartConfig
	result: QueryResult
	classified: Array<ClassifiedColumn>
	onReady?: (instance: echarts.ECharts | null) => void
	height?: string
}

export function ChartRouter({ config, result, classified, onReady, height = SQL_CHART_HEIGHT }: ChartRouterProps) {
	const common = { config, result, classified, onReady, height }
	switch (config.chartType) {
		case 'line':
			return <LineBarChart {...common} forceType="line" />
		case 'bar':
			return <LineBarChart {...common} forceType="bar" forceStack={config.stackMode !== 'off' ? 'bar' : undefined} />
		case 'area':
		case 'areaStacked':
		case 'areaPct':
			return <AreaChartAdapter {...common} />
		case 'hbar':
			return <HBarChartAdapter {...common} />
		case 'scatter':
			return <ScatterChartAdapter {...common} />
		case 'bubble':
			return <BubbleChartAdapter {...common} />
		case 'pie':
		case 'donut':
			return <PieChartAdapter {...common} />
		case 'treemap':
			return <TreemapChartAdapter {...common} />
		case 'histogram':
			return <HistogramChartAdapter {...common} />
		case 'candlestick':
			return <CandlestickChartAdapter {...common} />
		default:
			return <EmptyState size="md" icon="bar-chart-2" title="Unknown chart type" framed className="h-[220px]" />
	}
}

import type * as echarts from 'echarts/core'
import type { HeadlessChartExportButtons } from '~/components/ChartExport/types'

export interface ISankeyChartProps {
	height?: string
	nodes: Array<{
		name: string
		color?: string
		depth?: number
		description?: string
		displayValue?: number | string
		percentageLabel?: string
	}>
	links: Array<{ source: string; target: string; value: number; color?: string }>
	nodeColors?: Record<string, string>
	valueSymbol?: string
	nodeAlign?: 'left' | 'right' | 'justify'
	orient?: 'horizontal' | 'vertical'
	/** Where this chart's .csv/.png live: the handle its page's export buttons also take, or why it has none. */
	exportButtons: HeadlessChartExportButtons
	onReady?: (instance: echarts.ECharts | null) => void
}

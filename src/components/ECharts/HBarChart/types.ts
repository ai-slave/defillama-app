import type * as echarts from 'echarts/core'
import type { HeadlessChartExportButtons } from '~/components/ChartExport/types'

export interface IHBarChartProps {
	categories: Array<string>
	values: Array<number>
	valueSymbol?: string
	/** A fixed height. Left out, the chart fills its slot from a 360px floor (README → Size). */
	height?: string
	/** A min-h-* class that moves the 360px floor of a chart without `height`. */
	containerClassName?: string
	/** One color for every bar. */
	color?: string
	/** A color per bar, in `categories` order. */
	colors?: Array<string>
	logos?: Array<string>
	/** Several bars per category, each series with its own color; two or more replace `values`. */
	series?: Array<{ name: string; values: Array<number>; color: string }>
	valueAxisMin?: number | 'dataMin'
	valueAxisMax?: number | 'dataMax'
	valueAxisInterval?: number
	/** Print each bar's value at its end, so bars too small to see next to the largest still read. */
	showValueLabels?: boolean
	/** Where this chart's .csv/.png live: the handle its page's export buttons also take, or why it has none. */
	exportButtons: HeadlessChartExportButtons
	onReady?: (instance: echarts.ECharts | null) => void
}

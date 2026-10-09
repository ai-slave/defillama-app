import type * as echarts from 'echarts/core'

export interface IHBarChartProps {
	categories: Array<string>
	values: Array<number>
	valueSymbol?: string
	height?: string
	/** Replaces the fixed height: pass CHART_FILL to grow with a stretched panel. */
	containerClassName?: string
	/** One colour for every bar. */
	color?: string
	/** A colour per bar, in `categories` order. */
	colors?: Array<string>
	logos?: Array<string>
	/** Several bars per category, each series with its own colour; two or more replace `values`. */
	series?: Array<{ name: string; values: Array<number>; color: string }>
	valueAxisMin?: number | 'dataMin'
	valueAxisMax?: number | 'dataMax'
	valueAxisInterval?: number
	/** Print each bar's value at its end, so bars too small to see next to the largest still read. */
	showValueLabels?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
}

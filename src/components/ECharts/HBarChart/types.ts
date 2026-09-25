import type * as echarts from 'echarts/core'

export interface IHBarChartProps {
	categories: Array<string>
	values: Array<number>
	title?: string
	valueSymbol?: string
	height?: string
	color?: string
	colors?: Array<string>
	logos?: Array<string>
	series?: Array<{ name: string; values: Array<number>; color: string }>
	valueAxisMin?: number | 'dataMin'
	valueAxisMax?: number | 'dataMax'
	valueAxisInterval?: number
	/** Print each bar's value at its end, so bars too small to see next to the largest still read. */
	showValueLabels?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
}

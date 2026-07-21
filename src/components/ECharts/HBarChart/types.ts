import type * as echarts from 'echarts/core'

export interface IHBarChartProps {
	categories: string[]
	values: number[]
	title?: string
	valueSymbol?: string
	height?: string
	color?: string
	colors?: string[]
	logos?: string[]
	series?: Array<{ name: string; values: number[]; color: string }>
	valueAxisMin?: number | 'dataMin'
	valueAxisMax?: number | 'dataMax'
	valueAxisInterval?: number
	onReady?: (instance: echarts.ECharts | null) => void
}

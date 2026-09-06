import type * as echarts from 'echarts/core'

export type CandlestickPoint = [
	timestampMs: number,
	open: number,
	close: number,
	low: number,
	high: number,
	volume: number
]

export interface ICandlestickChartProps {
	data: Array<CandlestickPoint>
	height?: string
	onReady?: (instance: echarts.ECharts | null) => void
	indicators?: Array<{
		name: string
		category: 'overlay' | 'panel'
		data: Array<[number, number | null]>
		values?: Array<[number, Record<string, number | null>]>
		color?: string
	}>
}

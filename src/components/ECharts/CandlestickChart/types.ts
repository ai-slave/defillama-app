import type * as echarts from 'echarts/core'

export type CandlestickPoint = [
	timestampMs: number,
	open: number,
	close: number,
	low: number,
	high: number,
	/** Left off by every point of a chart that has no volume, which then draws no volume panel. */
	volume?: number
]

export interface ICandlestickChartProps {
	data: Array<CandlestickPoint>
	/** A fixed height. Left out, the chart fills its slot from a 360px floor, raised for indicator panels; the price grid takes the extra space (README → Size). */
	height?: string
	/** A min-h-* class that moves the 360px floor of a chart without `height`. */
	containerClassName?: string
	onReady?: (instance: echarts.ECharts | null) => void
	indicators?: Array<{
		name: string
		category: 'overlay' | 'panel'
		data: Array<[number, number | null]>
		values?: Array<[number, Record<string, number | null>]>
		color?: string
	}>
}

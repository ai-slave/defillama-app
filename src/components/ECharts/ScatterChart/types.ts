import type * as echarts from 'echarts/core'

export type ScatterChartValue = [x: number, y: number, ...metadata: Array<string | number | null | undefined>]

export interface ScatterChartPoint {
	value: ScatterChartValue
	seriesName?: string
	groupName?: string
	groupColor?: string
	showLabel?: boolean
	entitySlug?: string
	symbol?: string
	symbolSize?: number
	/** The point's own colour, such as a grade; points without one take their series colour. */
	itemStyle?: { color: string }
	label?: { show: boolean }
}

export interface YieldScatterChartPoint {
	projectName: string
	sigma?: number | null
	mu?: number | null
	count?: number | null
	symbol?: string | null
	pool?: string | null
	tvlUsd?: number | null
	apy?: number | null
	chain?: string | null
}

export type ScatterChartDatum = ScatterChartValue | ScatterChartPoint | YieldScatterChartPoint

export interface ScatterTooltipParams {
	value: ScatterChartValue
	data?: ScatterChartValue | ScatterChartPoint
	seriesName?: string
	name?: string
	/** The point's index within its series, in the order `chartData` lists that series' points. */
	dataIndex?: number
}

export interface IScatterChartProps {
	chartData: Array<ScatterChartDatum>
	title?: string
	xAxisLabel?: string
	yAxisLabel?: string
	valueSymbol?: string
	height?: string
	tooltipFormatter?: (params: ScatterTooltipParams) => string
	showLabels?: boolean
	entityType?: 'protocol' | 'chain'
	logScale?: boolean
	/** Both axes span exactly this range, whatever the data, and the chart does not zoom. */
	domain?: [min: number, max: number]
	/** A click pins the point's tooltip so a reader can enter it and follow its links; Escape or a click outside unpins. */
	pinnableTooltip?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
}

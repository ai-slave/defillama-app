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
}

export interface IScatterChartProps {
	chartData: ScatterChartDatum[]
	title?: string
	xAxisLabel?: string
	yAxisLabel?: string
	valueSymbol?: string
	height?: string
	tooltipFormatter?: (params: ScatterTooltipParams) => string
	showLabels?: boolean
	entityType?: 'protocol' | 'chain'
	logScale?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
}

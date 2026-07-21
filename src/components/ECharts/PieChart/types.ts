import type { LegendComponentOption } from 'echarts'
import type { PieSeriesOption } from 'echarts/charts'
import type * as echarts from 'echarts/core'
import type { ChartExportButtonsMode } from '~/components/ChartExport/types'

export interface PieTooltipParams {
	marker?: string
	name?: string
	percent?: number
	value?: unknown
}

export interface IPieChartProps {
	title?: string
	headingAs?: 'h1' | 'h2' | 'h3'
	chartData: Array<{ name: string; value: number }>
	height?: string
	stackColors?: Record<string, string>
	valueSymbol?: string
	radius?: [string, string]
	centerY?: `${number}%`
	showLegend?: boolean
	toRight?: number
	formatTooltip?: (params: PieTooltipParams) => string
	customLabel?: PieSeriesOption['label']
	legendPosition?: Pick<LegendComponentOption, 'left' | 'right' | 'top' | 'bottom' | 'orient'>
	legendTextStyle?: LegendComponentOption['textStyle']
	exportButtons?: ChartExportButtonsMode
	onReady?: (instance: echarts.ECharts | null) => void
}

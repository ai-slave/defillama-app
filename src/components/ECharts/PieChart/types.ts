import type { LegendComponentOption } from 'echarts'
import type { PieSeriesOption } from 'echarts/charts'
import type * as echarts from 'echarts/core'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
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
	/** A fixed height. Left out, the chart fills its slot from a 360px floor (README → Size). */
	height?: string
	stackColors?: Record<string, string>
	valueSymbol?: string
	radius?: [string, string]
	centerY?: `${number}%`
	showLegend?: boolean
	legendMinWidth?: number
	tooltipFormatter?: (params: PieTooltipParams) => string
	customLabel?: PieSeriesOption['label']
	legendPosition?: Pick<LegendComponentOption, 'left' | 'right' | 'top' | 'bottom' | 'orient'>
	legendTextStyle?: LegendComponentOption['textStyle']
	exportButtons: ChartExportButtonsMode
	/** What the CSV exports, the drawn slices by default; a pie folded past the series cap exports every row. */
	csvSource?: ChartCsvSource
	onReady?: (instance: echarts.ECharts | null) => void
}

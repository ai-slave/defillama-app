import type { EChartsOption, GridComponentOption, TooltipComponentOption, XAXisComponentOption } from 'echarts'
import type { MultiSeriesYAxisOption } from '../MultiSeriesChart/types'

/** Option overrides supported by the two remaining hand-built Cartesian renderers. */
export type LegacyCartesianChartOptions = Omit<
	EChartsOption,
	'series' | 'dataset' | 'grid' | 'tooltip' | 'xAxis' | 'yAxis'
> & {
	series?: never
	dataset?: never
	grid?: GridComponentOption
	tooltip?: TooltipComponentOption
	xAxis?: XAXisComponentOption
	yAxis?: MultiSeriesYAxisOption | MultiSeriesYAxisOption[]
}

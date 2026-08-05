import type {
	EChartsOption,
	GridComponentOption,
	TooltipComponentOption,
	XAXisComponentOption,
	YAXisComponentOption
} from 'echarts'
import type { LineSeriesOption } from 'echarts/charts'
import type * as echarts from 'echarts/core'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import type { ChartExportButtonsMode } from '~/components/ChartExport/types'

export type ChartTimeGrouping = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type ChartTimeGroupingWithCumulative = ChartTimeGrouping | 'cumulative'

type MultiSeriesChartValue = string | number | null | undefined
export type MultiSeriesChartArrayRow = MultiSeriesChartValue[]

export type MultiSeriesChartDataset = {
	/** Time-series rows use an ascending millisecond `timestamp`; category datasets may use another first dimension. */
	source: MultiSeriesChartArrayRow[]
	/** Logical dimensions used by chart encodes and CSV labels. ECharts receives private internal dimensions. */
	dimensions: string[]
}

export type CanonicalMultiSeriesChartDataset = MultiSeriesChartDataset

export type MultiSeriesTimeSeriesRow = [timestampMs: number, ...values: Array<number | null | undefined>]

export type MultiSeriesTimeSeriesDataset = {
	/** Ascending rows with the millisecond timestamp in the first column. */
	source: MultiSeriesTimeSeriesRow[]
	/** The first dimension is `timestamp`; remaining names address numeric series columns. */
	dimensions: [timestamp: 'timestamp', ...series: string[]]
}

export type MultiSeriesChartSeriesConfig = {
	type: 'line' | 'bar'
	/** Stable display identity. `selectedCharts` entries must match this name exactly. */
	name: string
	stack?: string
	/** `encode.y` is the canonical dataset dimension and may differ from the display name. */
	encode: {
		x: number | number[] | string | string[]
		y: number | number[] | string | string[]
	}
	/** Independently timed positional data. Use this when a wide union would introduce semantic null gaps. */
	data?: Array<[timestamp: number, value: number | null]>
	color?: string
	legendIconUrl?: string
	yAxisIndex?: number
	/** Per-series axis and tooltip unit. Falls back to the chart-level value symbol. */
	valueSymbol?: string
	hideAreaStyle?: boolean
	areaStyle?: LineSeriesOption['areaStyle']
	markLine?: LineSeriesOption['markLine']
	markArea?: LineSeriesOption['markArea']
	connectNulls?: boolean
	excludeFromTooltipTotal?: boolean
	isTBD?: boolean
	isForecast?: boolean
	showSymbol?: boolean
	symbol?: string
	symbolSize?: number
	barMinWidth?: number
	barMaxWidth?: number
	large?: boolean
}

type EChartsValueYAxisOption = Extract<YAXisComponentOption, { type?: 'value' }>
type EChartsLogYAxisOption = Extract<YAXisComponentOption, { type?: 'log' }>

type MultiSeriesValueYAxisOption = Omit<EChartsValueYAxisOption, 'type'> & { type?: 'value' }
type MultiSeriesLogYAxisOption = Omit<EChartsLogYAxisOption, 'type'> & { type: 'log' }

export type MultiSeriesYAxisOption = MultiSeriesValueYAxisOption | MultiSeriesLogYAxisOption

/** `min: undefined` intentionally clears the renderer's inherited zero-baseline callback during option merging. */
export type MultiSeriesYAxisOverride =
	| (Omit<MultiSeriesValueYAxisOption, 'type' | 'min'> & {
			type?: 'value'
			min?: MultiSeriesValueYAxisOption['min'] | undefined
	  })
	| (Omit<MultiSeriesLogYAxisOption, 'type' | 'min'> & {
			type: 'log'
			min?: MultiSeriesLogYAxisOption['min'] | undefined
	  })

/**
 * Only options backed by components registered in MultiSeriesChart are exposed.
 * This prevents a typed option from being silently ignored by the modular ECharts
 * runtime; series and dataset remain canonical renderer props.
 */
export type MultiSeriesChartOptions = Pick<EChartsOption, 'dataZoom' | 'graphic' | 'legend'> & {
	series?: never
	dataset?: never
	/** The renderer owns one Cartesian coordinate system. */
	grid?: GridComponentOption
	tooltip?: TooltipComponentOption
	xAxis?: XAXisComponentOption
	/** MultiSeriesChart owns a Cartesian numeric y scale; category/time y-axes are unsupported. */
	yAxis?: MultiSeriesYAxisOverride | MultiSeriesYAxisOverride[]
}

export interface IMultiSeriesChartProps {
	charts?: MultiSeriesChartSeriesConfig[]
	selectedCharts?: Set<string>
	chartOptions?: MultiSeriesChartOptions
	height?: string
	groupBy?: ChartTimeGroupingWithCumulative
	hallmarks?: [number, string][]
	rangeHallmarks?: Array<[[number, number], string]> | null
	hallmarksInMs?: boolean
	hallmarkStyle?: 'event-rail' | 'mark-line'
	expandTo100Percent?: boolean
	valueSymbol?: string
	alwaysShowTooltip?: boolean
	containerClassName?: string
	stacked?: boolean
	solidChartAreaStyle?: boolean
	hideDataZoom?: boolean
	/** Disable only when a caller has an established data-zoom rule independent of dataset row count. */
	autoHideDataZoom?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
	hideDefaultLegend?: boolean
	dataset: MultiSeriesChartDataset
	/** Explicit complete export source when `dataset` is only a visual presentation. */
	csvSource?: ChartCsvSource
	title?: string
	headingAs?: 'h1' | 'h2' | 'h3'
	/** One logo per category dimension, rendered below a category x-axis. */
	categoryLogos?: string[]
	/** Maximum tooltip series rows; non-positive values disable the cap. */
	tooltipMaxItems?: number
	/** Adds a total for same-unit series. Per-series unit overrides are excluded. */
	showTotalInTooltip?: boolean
	/** Hide the total when any displayed same-unit series is unavailable. */
	requireCompleteTooltipTotal?: boolean
	exportButtons?: ChartExportButtonsMode
	logScale?: boolean
	logEligibleYAxes?: number[]
	/** Use an explicit theme for standalone/embed callers; normal pages use the shared theme manager. */
	isThemeDark?: boolean
}

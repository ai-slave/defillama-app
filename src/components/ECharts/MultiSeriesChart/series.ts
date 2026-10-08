import type { BarSeriesOption, DefaultLabelFormatterCallbackParams, LineSeriesOption } from 'echarts'
import * as echarts from 'echarts/core'
import { CHART_COLORS } from '~/constants/colors'
import type { ChartTheme } from '../shared/chartTheme'
import type { buildHallmarksMarkLine } from './hallmarks'
import type { IMultiSeriesChartProps } from './types'

type NamedLineSeriesOption = Omit<LineSeriesOption, 'type'> & { name: string; type: 'line' }
type NamedBarSeriesOption = Omit<BarSeriesOption, 'type'> & { name: string; type: 'bar' }

type MultiSeriesRenderSeries = NamedLineSeriesOption | NamedBarSeriesOption
type GetChartInstance = () => echarts.ECharts | null

const MIN_PROJECTION_LABEL_HEIGHT_PX = 16
const EMPHASIS_COLOR_LIFT = 0.25

function createHatchPattern(color: string, opacity: number): { image: HTMLCanvasElement; repeat: 'repeat' } | null {
	if (typeof document === 'undefined') return null
	const size = 8
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (!context) return null
	context.strokeStyle = color
	context.globalAlpha = opacity
	context.lineWidth = 1.5
	context.beginPath()
	context.moveTo(0, size)
	context.lineTo(size, 0)
	context.stroke()
	return { image: canvas, repeat: 'repeat' }
}

/** Whether a projection end label fits the bar/line segment between the value and zero pixels. */
export function projectionLabelFits(valuePixel: number, zeroPixel: number): boolean {
	// A log axis cannot project zero; keep the label when pixel height is unavailable.
	if (!Number.isFinite(valuePixel) || !Number.isFinite(zeroPixel)) return true
	return Math.abs(valuePixel - zeroPixel) >= MIN_PROJECTION_LABEL_HEIGHT_PX
}

function createEndLabel(
	text: string,
	chartTheme: ChartTheme,
	offset: [number, number],
	seriesDimension: string | number | undefined,
	yAxisIndex: number,
	getChart: GetChartInstance | undefined
): NonNullable<LineSeriesOption['endLabel']> {
	return {
		show: true,
		formatter: getChart
			? (params: DefaultLabelFormatterCallbackParams) => {
					const instance = getChart()
					if (!instance || instance.isDisposed() || typeof seriesDimension !== 'number') return text
					const value = Array.isArray(params.value) ? params.value[seriesDimension] : undefined
					if (typeof value !== 'number') return text
					const valuePixel = instance.convertToPixel({ yAxisIndex }, value)
					const zeroPixel = instance.convertToPixel({ yAxisIndex }, 0)
					if (typeof valuePixel !== 'number' || typeof zeroPixel !== 'number') return text
					return projectionLabelFits(valuePixel, zeroPixel) ? text : ''
				}
			: text,
		fontSize: 16,
		fontWeight: 'bold',
		color: chartTheme.ink(0.3),
		offset
	}
}

/** Translate canonical chart configs into the ECharts series rendered by MultiSeriesChart. */
export function buildMultiSeries({
	charts,
	selectedCharts,
	expandTo100Percent,
	solidChartAreaStyle,
	chartTheme,
	hallmarksMarkLine,
	getChart,
	validLegendIcons
}: {
	charts: IMultiSeriesChartProps['charts']
	selectedCharts: IMultiSeriesChartProps['selectedCharts']
	expandTo100Percent: boolean | undefined
	solidChartAreaStyle: boolean
	chartTheme: ChartTheme
	hallmarksMarkLine?: ReturnType<typeof buildHallmarksMarkLine> | undefined
	/** Reads the live echarts instance when the end-label formatter paints. A getter rather than a ref
	    object so nothing ref-shaped crosses render, which is what lets MultiSeriesChart compile. */
	getChart?: GetChartInstance | undefined
	/** Legend icon URLs whose image has been probed and loads; other icons render as plain markers. */
	validLegendIcons: ReadonlySet<string>
}) {
	const output: Array<MultiSeriesRenderSeries> = []
	let hasExplicitYAxis = false

	const chartConfigs = charts ?? []
	for (let index = 0; index < chartConfigs.length; index++) {
		const chart = chartConfigs[index]!
		if (selectedCharts && !selectedCharts.has(chart.name)) continue
		if (chart.yAxisIndex != null) hasExplicitYAxis = true

		const color = chart.color ?? CHART_COLORS[index % CHART_COLORS.length]!
		const emphasisColor = echarts.color.lift(color, EMPHASIS_COLOR_LIFT)
		const common = {
			name: chart.name,
			encode: chart.encode,
			...(chart.data ? { data: chart.data } : {}),
			emphasis: { itemStyle: { color: emphasisColor } },
			itemStyle: { color },
			...(chart.legendIconUrl && validLegendIcons.has(chart.legendIconUrl)
				? { legendIcon: `image://${chart.legendIconUrl}` }
				: {}),
			...(chart.yAxisIndex != null ? { yAxisIndex: chart.yAxisIndex } : {})
		}
		let series: MultiSeriesRenderSeries
		if (chart.type === 'line') {
			const showSymbol = !!chart.showSymbol
			series = {
				...common,
				type: 'line',
				symbol: showSymbol ? (chart.symbol ?? 'circle') : 'none',
				showSymbol,
				...(showSymbol ? { symbolSize: chart.symbolSize ?? 6 } : {}),
				...(chart.connectNulls != null ? { connectNulls: chart.connectNulls } : {})
			}
		} else {
			// ECharts large mode skips stack layout, so configured stacked bars must opt out.
			series = {
				...common,
				type: 'bar',
				large: chart.large ?? chart.stack == null,
				...(chart.barMinWidth != null ? { barMinWidth: chart.barMinWidth } : {}),
				...(chart.barMinHeight != null ? { barMinHeight: chart.barMinHeight } : {}),
				...(chart.barMaxWidth != null ? { barMaxWidth: chart.barMaxWidth } : {})
			}
		}

		if (expandTo100Percent) {
			const isOverlay = chart.yAxisIndex != null && chart.yAxisIndex > 0
			if (!isOverlay) {
				series.stack = 'A'
				if (series.type === 'line') {
					series.lineStyle = { width: 0, color }
					series.areaStyle = {}
				}
			}
		} else {
			if (chart.stack != null) series.stack = chart.stack
			if (chart.stackStrategy != null) series.stackStrategy = chart.stackStrategy
			if (series.type === 'line') {
				series.lineStyle = { color }
				series.areaStyle =
					chart.areaStyle ??
					(solidChartAreaStyle
						? { color, opacity: 0.7 }
						: {
								color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
									{ offset: 0, color },
									{ offset: 1, color: chartTheme.areaGradientTo }
								])
							})
			}
		}

		if (series.type === 'line' && chart.hideAreaStyle) delete series.areaStyle
		if (series.type === 'line' && chart.step != null) series.step = chart.step
		if (series.type === 'line' && chart.lineStyle) {
			series.lineStyle = { ...series.lineStyle, ...chart.lineStyle }
		}
		if (chart.markLine != null) {
			series.markLine = chart.markLine
		} else if (output.length === 0 && hallmarksMarkLine) {
			series.markLine = hallmarksMarkLine
		}
		if (chart.markArea != null) series.markArea = chart.markArea

		// External emissions metadata can be inconsistent; TBD keeps the legacy precedence over forecast.
		const projection = chart.isTBD ? 'tbd' : chart.isForecast ? 'forecast' : null
		if (projection) {
			const isForecast = projection === 'forecast'
			const hatch = createHatchPattern(color, isForecast ? 0.8 : 0.4)
			series.itemStyle = { ...series.itemStyle, opacity: isForecast ? 0.5 : 0.3 }
			if (series.type === 'line' && series.areaStyle) {
				const areaStyle =
					series.areaStyle != null && typeof series.areaStyle === 'object' && !Array.isArray(series.areaStyle)
						? series.areaStyle
						: {}
				series.areaStyle = hatch ? { color: hatch, opacity: 0.6 } : { ...areaStyle, opacity: 0.1 }
			}
			if (series.type === 'line') {
				series.lineStyle = { ...series.lineStyle, type: 'dashed', width: 1.5, opacity: 0.5 }
			}
			if (series.type === 'line') {
				const seriesDimension = Array.isArray(chart.encode.y) ? chart.encode.y[0] : chart.encode.y
				series.endLabel = createEndLabel(
					isForecast ? 'Forecast' : 'TBD',
					chartTheme,
					isForecast ? [-80, 15] : [-40, 10],
					seriesDimension,
					chart.yAxisIndex ?? 0,
					getChart
				)
			}
		}

		output.push(series)
	}

	if (hasExplicitYAxis) {
		for (const series of output) series.yAxisIndex ??= 0
	}
	return output
}

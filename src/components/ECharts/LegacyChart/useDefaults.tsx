import type {
	DataZoomComponentOption,
	GraphicComponentOption,
	GridComponentOption,
	LegendComponentOption,
	TitleComponentOption,
	TooltipComponentOption,
	XAXisComponentOption
} from 'echarts'
import { BarChart, LineChart } from 'echarts/charts'
import {
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TitleComponent,
	TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useMemo } from 'react'
import { useMedia } from '~/hooks/useMedia'
import type { MultiSeriesYAxisOption } from '../MultiSeriesChart/types'
import {
	CHART_INSET,
	CHART_LEGEND_RESERVE,
	CHART_ZOOM_RESERVE,
	chartDataZoomSliderGeometry,
	chartGrid,
	chartHorizontalScrollLegendGeometry,
	chartLegendScrollStyle
} from '../shared/chartSpacing'
import type { ChartTheme } from '../shared/chartTheme'
import { formatChartEmphasisDate, formatTooltipValue } from '../shared/formatters'
import { createSignedInflowsTooltipFormatter } from '../shared/tooltip'
import { createAggregateTooltipFormatter, createLegacyTooltipFormatter } from './tooltip'

echarts.use([
	CanvasRenderer,
	LineChart,
	BarChart,
	TooltipComponent,
	TitleComponent,
	GridComponent,
	DataZoomComponent,
	GraphicComponent,
	MarkLineComponent,
	LegendComponent
])

interface IUseDefaultsProps {
	color?: string
	title?: string
	tooltipSort?: boolean
	valueSymbol?: string
	hideLegend?: boolean
	unlockTokenSymbol?: string
	isThemeDark: boolean
	chartTheme: ChartTheme
	groupBy?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
	alwaysShowTooltip?: boolean
	xAxisType?: 'time' | 'category'
	seriesValueSymbols?: Record<string, string>
}

interface LegacyChartDefaults {
	graphic: GraphicComponentOption
	grid: GridComponentOption
	titleDefaults: TitleComponentOption
	tooltip: TooltipComponentOption
	xAxis: XAXisComponentOption
	yAxis: MultiSeriesYAxisOption
	legend: LegendComponentOption
	dataZoom: DataZoomComponentOption[]
	inflowsTooltip: TooltipComponentOption
	aggregateTooltip: TooltipComponentOption
}

export function useDefaults({
	color,
	title,
	tooltipSort = true,
	valueSymbol = '',
	hideLegend,
	unlockTokenSymbol = '',
	isThemeDark,
	chartTheme,
	groupBy,
	alwaysShowTooltip,
	xAxisType = 'time',
	seriesValueSymbols
}: IUseDefaultsProps) {
	const isSmall = useMedia(`(max-width: 37.5rem)`)

	const defaults = useMemo<LegacyChartDefaults>(() => {
		const graphic: GraphicComponentOption = {
			type: 'image',
			z: 0,
			style: {
				image: isThemeDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
				height: 40,
				opacity: 0.3
			},
			left: isSmall ? '40%' : '45%',
			top: '130px'
		}

		const titleDefaults: TitleComponentOption = title
			? {
					text: title,
					textStyle: {
						fontFamily: 'sans-serif',
						fontWeight: 600,
						color: chartTheme.text
					},
					left: 15
				}
			: {}

		const getGridTop = (): number => {
			if (valueSymbol === '%') return CHART_LEGEND_RESERVE
			if (hideLegend) return CHART_INSET
			if (isSmall) return 64
			return CHART_LEGEND_RESERVE
		}
		const gridTop = getGridTop()

		const grid = chartGrid({
			bottom: CHART_ZOOM_RESERVE,
			top: title ? gridTop + 28 : gridTop
		})

		const tooltip: TooltipComponentOption = {
			trigger: 'axis',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: createLegacyTooltipFormatter({
				groupBy,
				valueSymbol,
				unlockTokenSymbol,
				seriesValueSymbols,
				tooltipSort,
				title
			}),
			...(alwaysShowTooltip
				? {
						className: undefined,
						position: [60, 0],
						backgroundColor: 'none',
						borderWidth: 0,
						padding: 8,
						boxShadow: 'none',
						textStyle: {
							color: chartTheme.text
						}
					}
				: {})
		}

		const inflowsTooltip: TooltipComponentOption = {
			trigger: 'axis',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: createSignedInflowsTooltipFormatter(valueSymbol)
		}

		const aggregateTooltip: TooltipComponentOption = {
			trigger: 'axis',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: createAggregateTooltipFormatter({ groupBy, valueSymbol }),
			...(alwaysShowTooltip
				? {
						className: undefined,
						position: [60, 0],
						backgroundColor: 'none',
						borderWidth: 0,
						padding: 8,
						boxShadow: 'none',
						textStyle: {
							color: chartTheme.text
						}
					}
				: {})
		}

		const xAxisBase = {
			nameTextStyle: {
				fontFamily: 'sans-serif',
				fontSize: 14,
				fontWeight: 400
			},
			axisLabel: {
				color: chartTheme.axisLabel
			},
			axisLine: {
				lineStyle: {
					color: chartTheme.text,
					opacity: 0.2
				}
			},
			splitLine: {
				lineStyle: {
					// gridline token is pre-multiplied (color × the old opacity)
					color: chartTheme.gridline
				}
			}
		}
		const xAxis: XAXisComponentOption =
			xAxisType === 'category'
				? { ...xAxisBase, type: 'category', boundaryGap: true }
				: { ...xAxisBase, type: 'time', boundaryGap: [0, 0] }

		const yAxis: MultiSeriesYAxisOption = {
			type: 'value',
			boundaryGap: [0, 0],
			nameTextStyle: {
				fontFamily: 'sans-serif',
				fontSize: 14,
				fontWeight: 400
			},
			axisLabel: {
				formatter: (value: number) => formatTooltipValue(value, valueSymbol),
				color: chartTheme.axisLabel
			},
			axisLine: {
				lineStyle: {
					color: chartTheme.text,
					opacity: 0.1
				}
			},
			splitLine: {
				lineStyle: {
					// gridline token is pre-multiplied (color × the old opacity)
					color: chartTheme.gridline
				}
			}
		}

		const legend: LegendComponentOption = {
			...chartLegendScrollStyle(chartTheme.legendPageActive, chartTheme.legendPageInactive, chartTheme.axisLabel),
			...chartHorizontalScrollLegendGeometry,
			textStyle: {
				fontFamily: 'sans-serif',
				fontSize: 12,
				fontWeight: 400,
				color: chartTheme.text
			},
			top: !hideLegend && isSmall && title ? 38 : CHART_INSET,
			right: !hideLegend && isSmall && title ? null : chartHorizontalScrollLegendGeometry.right
		}

		const dataZoom: DataZoomComponentOption[] = [
			{
				type: 'inside',
				start: 0,
				end: 100
			},
			{
				start: 0,
				end: 100,
				...chartDataZoomSliderGeometry,
				textStyle: {
					color: chartTheme.text
				},
				borderColor: chartTheme.zoomBorder,
				handleStyle: {
					borderColor: chartTheme.zoomHandleBorder,
					color: chartTheme.zoomHandleFill
				},
				moveHandleStyle: {
					color: chartTheme.zoomBorder
				},
				selectedDataBackground: {
					lineStyle: {
						color
					},
					areaStyle: {
						color
					}
				},
				emphasis: {
					handleStyle: {
						borderColor: chartTheme.zoomEmphasisBorder,
						color: chartTheme.zoomHandleBorder
					},
					moveHandleStyle: {
						borderColor: chartTheme.zoomEmphasisBorder,
						color: chartTheme.zoomEmphasisMoveFill
					}
				},
				fillerColor: chartTheme.zoomFiller,
				labelFormatter: formatChartEmphasisDate
			}
		]

		return { graphic, grid, titleDefaults, tooltip, xAxis, yAxis, legend, dataZoom, inflowsTooltip, aggregateTooltip }
	}, [
		color,
		isThemeDark,
		chartTheme,
		isSmall,
		title,
		tooltipSort,
		valueSymbol,
		hideLegend,
		unlockTokenSymbol,
		groupBy,
		alwaysShowTooltip,
		xAxisType,
		seriesValueSymbols
	])

	return defaults
}

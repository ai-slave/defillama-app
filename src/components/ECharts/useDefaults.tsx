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
import {
	CHART_INSET,
	CHART_LEGEND_RESERVE,
	CHART_LEGEND_RIGHT_INSET,
	CHART_ZOOM_RESERVE,
	chartDataZoomSliderGeometry,
	chartGrid,
	chartLegendScrollStyle
} from './chartSpacing'
import { useChartTheme } from './chartTheme'
import { formatChartEmphasisDate, formatTooltipChartDate, formatTooltipValue } from './formatters'

const CHART_SYMBOLS: Record<string, string> = {
	'Active Addresses': '',
	'Returning Addresses': '',
	'New Addresses': '',
	Transactions: '',
	'Total Proposals': '',
	'Successful Proposals': '',
	'Max Votes': '',
	TVL: '$',
	APY: '%',
	'Median APY': '%',
	Treasury: '$',
	Tweets: '',
	Contributors: '',
	Developers: '',
	'Contributors Commits': '',
	Commits: '',
	'Devs Commits': ''
}

// Helper to get the symbol for a series name in tooltip
const getSeriesSymbol = (
	seriesName: string,
	valueSymbol: string,
	unlockTokenSymbol: string,
	seriesValueSymbols: Record<string, string> | undefined
): string => {
	if (seriesName === 'Unlocks') return unlockTokenSymbol
	if (seriesValueSymbols?.[seriesName]) return seriesValueSymbols[seriesName]
	if (seriesName.includes('Users')) return 'Addresses'
	if (seriesName.includes('Addresses')) return ''
	if (seriesName.includes('Transactions')) return 'TXs'
	if (seriesName === 'TVL' && valueSymbol !== '$') return valueSymbol
	if (seriesName in CHART_SYMBOLS) return CHART_SYMBOLS[seriesName]
	return valueSymbol
}

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
	tooltipOrderBottomUp?: boolean
	tooltipValuesRelative?: boolean
	valueSymbol?: string
	hideLegend?: boolean
	isStackedChart?: boolean
	unlockTokenSymbol?: string
	isThemeDark: boolean
	hideOthersInTooltip?: boolean
	groupBy?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
	alwaysShowTooltip?: boolean
	showAggregateInTooltip?: boolean
	xAxisType?: 'time' | 'category'
	seriesValueSymbols?: Record<string, string>
}

export function useDefaults({
	color,
	title,
	tooltipSort = true,
	tooltipOrderBottomUp,
	tooltipValuesRelative,
	valueSymbol = '',
	hideLegend,
	isStackedChart,
	unlockTokenSymbol = '',
	isThemeDark,
	hideOthersInTooltip,
	groupBy,
	alwaysShowTooltip,
	showAggregateInTooltip: _showAggregateInTooltip = false,
	xAxisType = 'time',
	seriesValueSymbols
}: IUseDefaultsProps) {
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const chartTheme = useChartTheme(isThemeDark)

	const defaults = useMemo(() => {
		const graphic = {
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

		const titleDefaults = title
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

		const tooltip = {
			trigger: 'axis',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: function (params) {
				let chartdate =
					typeof params[0].value[0] === 'string'
						? `<strong>${params[0].value[0]}</strong><br/>`
						: formatTooltipChartDate(params[0].value[0], groupBy)

				let vals
				let filteredParams = params.filter((item) => item.value[1] !== '-' && item.value[1])

				if (isStackedChart) {
					filteredParams.reverse()
				} else {
					filteredParams.sort((a, b) =>
						tooltipSort
							? tooltipValuesRelative
								? b.value[1] - a.value[1]
								: Math.abs(b.value[1]) - Math.abs(a.value[1])
							: 0
					)
				}

				const otherIndex = filteredParams.findIndex((item) => item.seriesName === 'Others')
				let others

				if (otherIndex >= 0 && otherIndex < 10) {
					others = filteredParams[otherIndex]
					filteredParams = filteredParams.filter((item) => item.seriesName !== 'Others')
				}
				const topParams = filteredParams.slice(0, 10)
				const otherParams = filteredParams.slice(10)

				if (tooltipOrderBottomUp) {
					topParams.reverse()
				}

				vals = topParams.reduce((prev, curr) => {
					const displayValue = curr.value[2] !== undefined ? curr.value[2] : curr.value[1]
					return (prev +=
						'<li style="list-style:none">' +
						curr.marker +
						curr.seriesName +
						'&nbsp;&nbsp;' +
						formatTooltipValue(
							displayValue,
							getSeriesSymbol(curr.seriesName, valueSymbol, unlockTokenSymbol, seriesValueSymbols)
						) +
						'</li>')
				}, '')

				if (otherParams.length !== 0 && !hideOthersInTooltip) {
					const otherString =
						'<li style="list-style:none">' +
						(others?.marker ?? otherParams[0].marker) +
						'Others' +
						'&nbsp;&nbsp;' +
						formatTooltipValue(
							otherParams.reduce((prev, curr) => prev + curr.value[1], 0) + (others?.value[1] ?? 0),
							valueSymbol
						) +
						'</li>'

					if (tooltipOrderBottomUp) {
						vals = otherString + vals
					} else {
						vals += otherString
					}
				}

				const mcap = params.filter((param) => param.seriesName === 'Mcap')?.[0]?.value[1]
				const tvl = params.filter((param) => param.seriesName === 'TVL')?.[0]?.value[1]

				if (mcap && mcap !== '-' && tvl) {
					vals += `<li style="list-style:none">Mcap/TVL&nbsp;&nbsp;${Number(mcap / tvl).toFixed(2)}</li>`
				}

				if (title && (title.toLowerCase() === 'tokens (usd)' || title.toLowerCase() === 'chains')) {
					const total = params.reduce((acc, curr) => (acc += curr.value[1]), 0)

					vals +=
						'<li style="list-style:none;font-weight:600">' +
						'Total' +
						'&nbsp;&nbsp;' +
						formatTooltipValue(total, valueSymbol) +
						'</li>'
				}

				return chartdate + vals
			},
			...(alwaysShowTooltip
				? {
						className: undefined,
						position: [60, 0],
						backgroundColor: 'none',
						borderWidth: '0',
						padding: 8,
						boxShadow: 'none',
						textStyle: {
							color: chartTheme.text
						}
					}
				: {})
		}

		const inflowsTooltip = {
			trigger: 'axis',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: function (params) {
				const chartdate = formatTooltipChartDate(params[0].value[0], 'daily')

				let vals = params
					.sort((a, b) => (tooltipSort ? a.value[1] - b.value[1] : 0))
					.slice(0, 10)
					.reduce((prev, curr) => {
						if (curr.value[1] !== 0 && curr.value[1] !== '-') {
							return (prev +=
								'<li style="list-style:none">' +
								curr.marker +
								curr.seriesName +
								'&nbsp;&nbsp;' +
								formatTooltipValue(curr.value[1], valueSymbol) +
								'</li>')
						} else return prev
					}, '')

				const others = params.slice(10).reduce((acc, curr) => (acc += curr.value[1]), 0)

				if (others) {
					vals +=
						'<li style="list-style:none">' +
						'Others' +
						'&nbsp;&nbsp;' +
						formatTooltipValue(others, valueSymbol) +
						'</li>'
				}

				const total = params.reduce((acc, curr) => (acc += curr.value[1]), 0)

				vals +=
					'<li style="list-style:none;font-weight:600">' +
					'Total Inflows' +
					'&nbsp;&nbsp;' +
					formatTooltipValue(total, valueSymbol) +
					'</li>'

				return chartdate + vals
			}
		}

		const aggregateTooltip = {
			trigger: 'axis',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: function (params) {
				if (Array.isArray(params) && params.length > 1) {
					const chartdate = formatTooltipChartDate(params[0].value[0], groupBy)

					let filteredParams = params.filter((item) => item.value[1] !== '-' && item.value[1])

					filteredParams.sort((a, b) => Math.abs(b.value[1]) - Math.abs(a.value[1]))

					const vals = filteredParams.reduce((prev, curr) => {
						return (prev +=
							'<li style="list-style:none">' +
							curr.marker +
							curr.seriesName +
							'&nbsp;&nbsp;' +
							formatTooltipValue(curr.value[1], valueSymbol) +
							'</li>')
					}, '')

					const total = filteredParams.reduce((acc, curr) => acc + curr.value[1], 0)

					const totalLine =
						'<li style="list-style:none;font-weight:600">' +
						'Total' +
						'&nbsp;&nbsp;' +
						formatTooltipValue(total, valueSymbol) +
						'</li>'

					return chartdate + vals + totalLine
				} else if (params && !Array.isArray(params)) {
					const chartdate = formatTooltipChartDate(params.value[0], groupBy)
					const value = formatTooltipValue(params.value[1], valueSymbol)

					return (
						chartdate +
						'<li style="list-style:none">' +
						params.marker +
						params.seriesName +
						'&nbsp;&nbsp;' +
						value +
						'</li>'
					)
				}

				return ''
			},
			...(alwaysShowTooltip
				? {
						className: undefined,
						position: [60, 0],
						backgroundColor: 'none',
						borderWidth: '0',
						padding: 8,
						boxShadow: 'none',
						textStyle: {
							color: chartTheme.text
						}
					}
				: {})
		}

		const xAxis = {
			type: xAxisType,
			boundaryGap: xAxisType === 'category',
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

		const yAxis = {
			type: 'value',
			boundaryGap: false,
			nameTextStyle: {
				fontFamily: 'sans-serif',
				fontSize: 14,
				fontWeight: 400
			},
			axisLabel: {
				formatter: (value) => formatTooltipValue(value, valueSymbol),
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

		const legend = {
			...chartLegendScrollStyle(chartTheme.legendPageActive, chartTheme.legendPageInactive, chartTheme.axisLabel),
			textStyle: {
				fontFamily: 'sans-serif',
				fontSize: 12,
				fontWeight: 400,
				color: chartTheme.text
			},
			top: !hideLegend && isSmall && title ? 38 : CHART_INSET,
			right: !hideLegend && isSmall && title ? null : CHART_LEGEND_RIGHT_INSET
		}

		const dataZoom = [
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
		isStackedChart,
		tooltipOrderBottomUp,
		unlockTokenSymbol,
		hideOthersInTooltip,
		tooltipValuesRelative,
		groupBy,
		alwaysShowTooltip,
		xAxisType,
		seriesValueSymbols
	])

	return defaults
}

import { aggregate } from 'echarts-simple-transform'
import { BoxplotChart as EChartBoxPlot } from 'echarts/charts'
import {
	DatasetComponent,
	DataZoomComponent,
	GridComponent,
	LegendComponent,
	TitleComponent,
	ToolboxComponent,
	TooltipComponent,
	TransformComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useId, useMemo, useRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { getChartTheme } from '../chartTheme'

echarts.use([
	CanvasRenderer,
	EChartBoxPlot,
	TooltipComponent,
	ToolboxComponent,
	TitleComponent,
	GridComponent,
	DataZoomComponent,
	LegendComponent,
	DatasetComponent,
	TransformComponent,
	UniversalTransition
])

// Register transform once at module level
echarts.registerTransform(aggregate)

interface IChartProps {
	chartData: any
}

export default function BoxplotChart({ chartData }: IChartProps) {
	const id = useId()

	const [isDark] = useDarkModeManager()
	const chartRef = useRef<echarts.ECharts | null>(null)

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef)

	// Memoize data to prevent effect re-running on every render
	const data = useMemo(() => {
		const rows = chartData.map((p) => [p.apy, p.projectName])
		rows.unshift(['APY', 'Project'])
		return rows
	}, [chartData])

	useEffect(() => {
		const el = document.getElementById(id)
		if (!el) return
		const instance = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance

		const option = {
			dataset: [
				{
					id: 'raw',
					source: data
				},
				{
					id: 'apy_aggregate',
					fromDatasetId: 'raw',
					transform: [
						{
							type: 'ecSimpleTransform:aggregate',
							config: {
								resultDimensions: [
									{ name: 'count', from: 'APY', method: 'count' },
									{ name: 'min', from: 'APY', method: 'min' },
									{ name: 'Q1', from: 'APY', method: 'Q1' },
									{ name: 'median', from: 'APY', method: 'median' },
									{ name: 'Q3', from: 'APY', method: 'Q3' },
									{ name: 'max', from: 'APY', method: 'max' },
									{ name: 'Project', from: 'Project' }
								],
								groupBy: 'Project'
							}
						},
						{
							type: 'sort',
							config: {
								dimension: 'Q3',
								order: 'asc'
							}
						}
					]
				}
			],
			title: {
				text: 'Spot APY distribution',
				textStyle: {
					fontFamily: 'sans-serif',
					fontWeight: 600,
					color: getChartTheme(isDark).text
				}
			},
			tooltip: {
				trigger: 'axis',
				confine: true,
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0
			},
			toolbox: {
				feature: {
					restore: {}
				}
			},
			xAxis: {
				scale: true,
				boundaryGap: false,
				name: 'APY',
				nameLocation: 'middle',
				nameGap: 30,
				nameTextStyle: {
					fontFamily: 'sans-serif',
					fontSize: 14,
					fontWeight: 500
				},
				axisLabel: {
					color: getChartTheme(isDark).axisLabel
				},
				splitLine: {
					lineStyle: {
						color: getChartTheme(isDark).gridline
					}
				}
			},
			yAxis: {
				type: 'category',
				boundaryGap: false,
				nameTextStyle: {
					fontFamily: 'sans-serif',
					fontSize: 14,
					fontWeight: 600
				},
				axisLabel: {
					color: getChartTheme(isDark).axisLabel
				},
				splitLine: {
					lineStyle: {
						color: getChartTheme(isDark).gridline
					}
				}
			},
			grid: {
				bottom: 100
			},
			legend: {
				selected: { detail: false }
			},
			dataZoom: [
				{
					type: 'inside',
					start: 0,
					end: 100,
					filterMode: 'none'
				},
				{
					type: 'slider',
					start: 0,
					end: 100,
					filterMode: 'none',
					textStyle: {
						color: getChartTheme(isDark).text
					},
					borderColor: getChartTheme(isDark).zoomBorder,
					handleStyle: {
						borderColor: getChartTheme(isDark).zoomHandleBorder,
						color: getChartTheme(isDark).zoomHandleFill
					},
					moveHandleStyle: {
						color: getChartTheme(isDark).zoomBorder
					},
					selectedDataBackground: {
						lineStyle: {
							color: '#445ed0'
						},
						areaStyle: {
							color: '#445ed0'
						}
					},
					emphasis: {
						handleStyle: {
							borderColor: getChartTheme(isDark).zoomEmphasisBorder,
							color: getChartTheme(isDark).zoomHandleBorder
						},
						moveHandleStyle: {
							borderColor: getChartTheme(isDark).zoomEmphasisBorder,
							color: getChartTheme(isDark).zoomEmphasisMoveFill
						}
					},
					fillerColor: getChartTheme(isDark).zoomFiller
				}
			],
			series: [
				{
					type: 'boxplot',
					datasetId: 'apy_aggregate',
					itemStyle: {
						color: '#b8c5f2'
					},
					encode: {
						x: ['min', 'Q1', 'median', 'Q3', 'max'],
						y: 'Project',
						itemName: ['Project'],
						tooltip: ['count', 'min', 'Q1', 'median', 'Q3', 'max']
					}
				}
			]
		}
		instance.setOption(option)

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [id, data, isDark])

	return (
		<div className="relative flex flex-col items-end rounded-md bg-(--legacy-cards-bg) p-3">
			<div id={id} className="min-h-[800px] w-full" />
		</div>
	)
}

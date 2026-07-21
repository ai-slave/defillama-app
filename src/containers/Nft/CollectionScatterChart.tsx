import type { EChartsOption } from 'echarts'
import {
	BarChart as EChartBar,
	LineChart as EChartLine,
	ScatterChart as EChartScatter,
	type BarSeriesOption,
	type LineSeriesOption,
	type ScatterSeriesOption
} from 'echarts/charts'
import {
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	TitleComponent,
	TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import * as React from 'react'
import { chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import type { ICollectionScatterChartProps } from './types'

echarts.use([
	CanvasRenderer,
	EChartScatter,
	EChartLine,
	EChartBar,
	TooltipComponent,
	TitleComponent,
	GridComponent,
	GraphicComponent,
	LegendComponent,
	DataZoomComponent
])

export default function CollectionScatterChart({ height, sales, salesMedian1d, volume }: ICollectionScatterChartProps) {
	const isSmall = useMedia(`(max-width: 37.5rem)`)

	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const chartRef = React.useRef<echarts.ECharts | null>(null)

	useChartResize(chartRef, containerRef)

	React.useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	React.useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const series: Array<ScatterSeriesOption | LineSeriesOption | BarSeriesOption> =
			sales.length > 0
				? [
						{
							name: 'Sale Price',
							type: 'scatter',
							large: true,
							emphasis: {
								focus: 'series'
							},
							itemStyle: {
								color: '#3b82f6'
							},
							symbolSize: 3,
							data: sales
						},
						{
							name: 'Moving Average',
							type: 'line',
							itemStyle: {
								color: '#ffc300'
							},
							data: salesMedian1d,
							showSymbol: false,
							connectNulls: true
						},
						{
							name: 'Volume',
							type: 'bar',
							data: volume.map((p) => [p[0] * 1e3, p[1]]),
							itemStyle: {
								color: '#22c55e'
							},
							yAxisIndex: 1
						}
					]
				: []

		const option: EChartsOption = {
			animation: false,
			graphic: {
				type: 'image',
				z: 0,
				style: {
					image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
					height: 40,
					opacity: 0.3
				},
				left: isSmall ? '40%' : '45%',
				top: '130px'
			},
			grid: chartGrid(),
			tooltip: {
				showDelay: 0,
				confine: true,
				formatter: function (rawParams: unknown) {
					const params = normalizeTooltipItems(rawParams)[0]
					const value = Array.isArray(params?.value) ? params.value : Array.isArray(params?.data) ? params.data : []
					const timestamp = typeof value[0] === 'number' ? value[0] : Number(value[0])
					const amount = typeof value[1] === 'number' ? value[1] : Number(value[1])
					if (!params || !Number.isFinite(timestamp) || !Number.isFinite(amount)) return ''
					const chartdate = formatTooltipChartDate(timestamp, 'daily')

					let vals =
						chartdate +
						'<li style="list-style:none">' +
						params.marker +
						params.seriesName +
						':' +
						'&nbsp;&nbsp;' +
						amount.toFixed(2) +
						'&nbsp;' +
						'ETH' +
						'</li>'

					if (params.seriesName !== 'Volume') {
						const date = timestamp

						vals +=
							'<li style="list-style:none">' +
							'<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:#ffc300;"></span>' +
							'Moving Average:' +
							'&nbsp;&nbsp;' +
							findClosestChartValue(salesMedian1d, date, 1) +
							'&nbsp;' +
							'ETH' +
							'</li>'

						vals +=
							'<li style="list-style:none">' +
							'<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:#22c55e;"></span>' +
							'Volume:' +
							'&nbsp;&nbsp;' +
							findClosestChartValue(volume, date, 1e3) +
							'&nbsp;' +
							'ETH' +
							'</li>'
					}

					return vals
				}
			},
			xAxis: {
				type: 'time',
				boundaryGap: [0, 0],
				min: salesMedian1d.length > 0 ? salesMedian1d[0][0] : 0,
				nameTextStyle: {
					fontFamily: 'sans-serif',
					fontSize: 14,
					fontWeight: 400
				},
				axisLabel: {
					color: chartTheme.text
				},
				axisLine: {
					lineStyle: {
						color: chartTheme.text,
						opacity: 0.2
					}
				},
				splitLine: {
					lineStyle: {
						color: chartTheme.gridline
					}
				}
			},
			yAxis: [
				{
					type: 'value',
					min: 'dataMin',
					axisLabel: {
						formatter: (value: number) => Number(value.toFixed(2)) + ' ETH',
						color: chartTheme.text
					},
					axisLine: {
						lineStyle: {
							color: chartTheme.text,
							opacity: 0.1
						}
					},
					boundaryGap: [0, 0],
					nameTextStyle: {
						fontFamily: 'sans-serif',
						fontSize: 14,
						fontWeight: 400
					},
					splitLine: {
						lineStyle: {
							color: chartTheme.gridline
						}
					}
				},
				{
					type: 'value',
					name: 'Volume',
					show: false,
					max: (value: { max: number }) => value.max * 4,
					position: 'right',
					axisLine: {
						show: false
					},
					axisLabel: {
						show: false
					},
					splitLine: {
						show: false
					}
				}
			],
			dataZoom: [
				{
					type: 'inside',
					start: 0,
					end: 100,
					filterMode: 'none'
				}
			],
			series: series
		}

		instance.setOption(option, { notMerge: true })
	}, [sales, volume, chartTheme, isDark, isSmall, salesMedian1d])

	return <div ref={containerRef} className="h-[360px]" style={height ? { height } : undefined} />
}

export function findClosestChartValue(
	rows: Array<[number, number]>,
	targetMs: number,
	timestampMultiplier: 1 | 1000
): string {
	if (rows.length === 0) return '0'

	let low = 0
	let high = rows.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if (rows[middle][0] * timestampMultiplier < targetMs) low = middle + 1
		else high = middle
	}

	if (low === 0) return rows[0][1].toFixed(2)
	if (low === rows.length) return rows[rows.length - 1][1].toFixed(2)

	const previous = rows[low - 1]
	const next = rows[low]
	const previousDistance = targetMs - previous[0] * timestampMultiplier
	const nextDistance = next[0] * timestampMultiplier - targetMs
	return (previousDistance <= nextDistance ? previous[1] : next[1]).toFixed(2)
}

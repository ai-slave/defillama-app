import type { EChartsOption } from 'echarts'
import { LineChart as EChartLine, type LineSeriesOption } from 'echarts/charts'
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
import { normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { roundNumber } from '~/utils/numberFormat'
import type { IOrderBookChartProps } from './types'

echarts.use([
	CanvasRenderer,
	EChartLine,
	TooltipComponent,
	TitleComponent,
	GridComponent,
	GraphicComponent,
	LegendComponent,
	DataZoomComponent
])

export default function OrderBookChart({ height, chartData }: IOrderBookChartProps) {
	const isSmall = useMedia(`(max-width: 37.5rem)`)

	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const chartRef = React.useRef<echarts.ECharts | null>(null)
	const hasData = Array.isArray(chartData) && chartData.length > 0

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	React.useEffect(() => {
		if (!hasData) return
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [hasData])

	React.useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const askData: Array<[number, number, number, number, string]> = []
		const bidData: Array<[number, number, number, number, string]> = []
		for (const item of chartData) {
			if (item.price <= 0) continue
			if (item.orderType === 'ask') {
				askData.push([item.price, item.amount, item.avgPrice, item.priceTotal, item.orderType])
			} else if (item.orderType === 'bid' && bidData.length < 62) {
				bidData.push([item.price, item.amount, item.avgPrice, item.priceTotal, item.orderType])
			}
		}

		const series: LineSeriesOption[] = [
			{
				name: 'Ask',
				type: 'line',
				stack: 'Ask',
				step: 'start',
				emphasis: { focus: 'series' },
				symbol: 'none',
				itemStyle: {
					color: '#3b82f6'
				},
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{
							offset: 0,
							color: 'blue'
						},
						{
							offset: 1,
							color: chartTheme.areaGradientTo
						}
					])
				},
				data: askData
			},
			{
				name: 'Bid',
				type: 'line',
				stack: 'Bid',
				step: 'start',
				emphasis: { focus: 'series' },
				symbol: 'none',
				itemStyle: {
					color: '#22c55e'
				},
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{
							offset: 0,
							color: 'green'
						},
						{
							offset: 1,
							color: chartTheme.areaGradientTo
						}
					])
				},
				data: bidData
			}
		]

		const option: EChartsOption = {
			animation: false,
			title: {
				text: 'Orderbook',
				textStyle: {
					fontFamily: 'sans-serif',
					fontWeight: 600,
					color: chartTheme.text
				},
				left: 15
			},
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
			grid: chartGrid({ top: (isSmall ? 60 : 10) + 48 }),
			tooltip: {
				trigger: 'axis',
				confine: true,
				formatter: function (rawParams: unknown) {
					const point = normalizeTooltipItems(rawParams)[0]
					if (!point) return ''
					const value = Array.isArray(point.value) ? point.value : Array.isArray(point.data) ? point.data : []

					let vals = `<li style="list-style:none">${point.marker}${point.seriesName}</li>`

					vals += `<li style="list-style:none">Amount :  ${value[1] ?? ''}</li>`
					vals += `<li style="list-style:none">Price :  ${value[0] ?? ''} ETH</li>`
					vals += `<li style="list-style:none">Avg Price :  ${value[2] ?? ''} ETH</li>`
					vals += `<li style="list-style:none">Total Price :  ${value[3] ?? ''} ETH</li>`
					return vals
				},
				showDelay: 0
			},
			legend: {
				textStyle: {
					fontFamily: 'sans-serif',
					fontSize: 12,
					fontWeight: 400,
					color: chartTheme.text
				},
				top: isSmall ? 30 : 0,
				right: isSmall ? null : 20,
				show: true
			},
			xAxis: {
				name: 'Price',
				type: 'log',
				axisLabel: {
					formatter: (value: number) => roundNumber(value, 2) + ' ETH',
					color: chartTheme.text
				},
				boundaryGap: [0, 0],
				nameTextStyle: {
					fontFamily: 'sans-serif',
					fontSize: 14,
					fontWeight: 400
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
			yAxis: {
				name: 'Amount',
				type: 'value',
				axisLabel: {
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
	}, [chartData, chartTheme, isDark, isSmall])

	return <div ref={containerRef} className="h-[360px]" style={height ? { height } : undefined} />
}

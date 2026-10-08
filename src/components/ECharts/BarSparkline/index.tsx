import type { EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useMemo, useRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { withEChartsRenderVisibility } from '../renderVisibility'
import { useChartTheme } from '../shared/chartTheme'
import { sparklineAxisMax, sparklineAxisMin } from './extent'

echarts.use([BarChart, GridComponent, CanvasRenderer])

type PrimitiveBarPoint = [number, number]

interface BarSparklineProps {
	data?: Array<PrimitiveBarPoint>
	className?: string
	height?: number | string
	maxBars?: number
}

function BarSparklineRenderer({ data, className, height = 48, maxBars = 60 }: BarSparklineProps) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)

	useChartResize(chartRef, containerRef)
	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)

	const chartData = useMemo(() => {
		const xAxisData: Array<number> = []
		const bars: Array<{ value: number; itemStyle: { color: string; borderRadius: Array<number> } }> = []
		if (!data?.length) return { xAxisData, bars }

		const step = data.length > maxBars ? Math.ceil(data.length / maxBars) : 1
		let previousValue: number | undefined
		let lastIndex = -1
		const appendPoint = (index: number) => {
			const [timestamp, value] = data[index]!
			xAxisData.push(timestamp * 1000)
			bars.push({
				value,
				itemStyle: {
					color: previousValue !== undefined && value < previousValue ? chartTheme.down : chartTheme.up,
					borderRadius: [2, 2, 0, 0]
				}
			})
			previousValue = value
			lastIndex = index
		}

		for (let i = 0; i < data.length; i += step) {
			appendPoint(i)
		}
		if (lastIndex !== data.length - 1) {
			appendPoint(data.length - 1)
		}

		return { xAxisData, bars }
	}, [data, maxBars, chartTheme])
	const hasData = chartData.xAxisData.length > 0

	useEffect(() => {
		if (!hasData) return
		const dom = containerRef.current
		if (!dom) return
		const instance = echarts.init(dom, undefined, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [hasData])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		if (instance.isDisposed()) return

		// Dynamic bar sizing based on number of data points
		const barCount = chartData.xAxisData.length
		// For fewer bars, use thicker bars with less gap
		const barMaxWidth = barCount <= 7 ? 20 : barCount <= 15 ? 14 : barCount <= 30 ? 8 : barCount <= 60 ? 5 : 3
		const barCategoryGap = barCount <= 7 ? '25%' : barCount <= 15 ? '35%' : barCount <= 30 ? '40%' : '50%'

		const option: EChartsOption = {
			grid: {
				left: 0,
				right: 0,
				top: 2,
				bottom: 0,
				containLabel: false
			},
			animation: false,
			xAxis: {
				type: 'category',
				data: chartData.xAxisData,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { show: false },
				splitLine: { show: false }
			},
			yAxis: {
				type: 'value',
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { show: false },
				splitLine: { show: false },
				min: sparklineAxisMin,
				max: sparklineAxisMax
			},
			series: [
				{
					type: 'bar',
					data: chartData.bars,
					barMaxWidth,
					barMinWidth: 4,
					barCategoryGap
				}
			]
		}
		instance.setOption(option, true)
	}, [chartData])

	if (!hasData) {
		return null
	}

	return <div ref={containerRef} className={className} style={{ width: '100%', height, pointerEvents: 'none' }} />
}

export const BarSparkline = withEChartsRenderVisibility(BarSparklineRenderer)

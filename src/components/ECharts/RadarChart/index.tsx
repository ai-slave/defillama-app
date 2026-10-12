import type { EChartsOption } from 'echarts'
import { RadarChart as ERadarChart } from 'echarts/charts'
import { GraphicComponent, RadarComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useRef } from 'react'
import { chartColor } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formatNumber } from '~/utils/numberFormat'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { type ChartTheme, useChartTheme } from '../shared/chartTheme'
import { escapeHtml } from '../shared/escapeHtml'
import { chartWatermarkGraphic, useCanvasWatermarkEnabled } from '../shared/watermark'

echarts.use([ERadarChart, RadarComponent, TooltipComponent, GraphicComponent, CanvasRenderer])

export interface RadarIndicator {
	/** Axis label; a `\n` wraps it on the chart and becomes a space in the tooltip. */
	name: string
	max: number
}

export interface IRadarChartProps {
	indicators: ReadonlyArray<RadarIndicator>
	/** One value per indicator, in indicator order. */
	values: Array<number>
	height?: string
	onReady?: (instance: echarts.ECharts | null) => void
}

export function buildRadarOption(
	indicators: ReadonlyArray<RadarIndicator>,
	values: Array<number>,
	chartTheme: ChartTheme
): EChartsOption {
	const color = chartColor(0)
	return {
		tooltip: {
			trigger: 'item',
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: () =>
				indicators
					.map(({ name }, i) => `${escapeHtml(name.replace('\n', ' '))}: ${formatNumber(values[i]!)}`)
					.join('<br/>')
		},
		radar: {
			indicator: indicators.map(({ name, max }) => ({ name, max })),
			radius: '65%',
			axisName: { color: chartTheme.axisLabel }
		},
		series: [
			{
				type: 'radar',
				itemStyle: { color },
				lineStyle: { color },
				data: [{ value: values, areaStyle: { color, opacity: 0.2 } }]
			}
		]
	}
}

function RadarChart({ indicators, values, height = '280px', onReady }: IRadarChartProps) {
	const [isDark] = useDarkModeManager()
	const canvasWatermarkEnabled = useCanvasWatermarkEnabled()
	const chartTheme = useChartTheme(isDark)
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	useChartResize(chartRef, containerRef)

	useEffect(() => {
		const chartDom = containerRef.current
		if (!chartDom) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		emitReady(instance)

		return () => {
			persistentLifecycle.capture(instance)
			chartRef.current = null
			emitReady(null)
			instance.dispose()
		}
	}, [persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		instance.setOption(
			{
				...buildRadarOption(indicators, values, chartTheme),
				graphic: canvasWatermarkEnabled ? chartWatermarkGraphic(instance, isDark, 'under') : []
			},
			{ notMerge: true }
		)
	}, [indicators, values, chartTheme, canvasWatermarkEnabled, isDark])

	return <div ref={containerRef} className="w-full" style={{ height }} />
}

export default withEChartsRenderVisibility(RadarChart)

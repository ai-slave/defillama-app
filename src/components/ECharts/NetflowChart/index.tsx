import type { EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { DatasetComponent, GraphicComponent, GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import type { BridgeNetflowPeriod } from '~/containers/Bridges/api.types'
import type { BridgeNetflowChartData } from '~/containers/Bridges/types'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { formatCompactNumber } from '~/utils/numberFormat'
import { chartGrid } from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { normalizeTooltipItems } from '../shared/tooltip'
import { chartWatermarkGraphic, useCanvasWatermarkEnabled } from '../shared/watermark'
import { buildNetflowBars } from './data'

echarts.use([BarChart, TooltipComponent, GridComponent, DatasetComponent, GraphicComponent, CanvasRenderer])

export interface NetflowChartProps {
	height?: number | string
	onReady?: (instance: echarts.ECharts | null) => void
	data: BridgeNetflowChartData
}

export default function NetflowChart({ height, onReady, data: allData }: NetflowChartProps) {
	const [isThemeDark] = useDarkModeManager()
	const canvasWatermarkEnabled = useCanvasWatermarkEnabled()
	const chartTheme = useChartTheme(isThemeDark)
	const [period, setPeriod] = useState<BridgeNetflowPeriod>('month')
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	// Observes the container, so a new height resizes the chart too
	useChartResize(chartRef, containerRef)

	const { positiveData, negativeData, chains, csvSource } = useMemo(
		() => buildNetflowBars(allData[period]),
		[allData, period]
	)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	const heightStyle = useMemo(() => {
		if (height == null) return undefined
		if (typeof height === 'number') return { height: `${height}px` }
		return { height }
	}, [height])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option: EChartsOption = {
			tooltip: {
				trigger: 'axis',
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				axisPointer: {
					type: 'shadow'
				},
				formatter: (params) => {
					const items = normalizeTooltipItems(params)
					const chain = items[0]?.axisValue ?? ''
					const outflow = items[0]?.value
					const inflow = items[1]?.value
					const value = (typeof outflow === 'number' ? outflow : 0) + (typeof inflow === 'number' ? inflow : 0)
					return `<div class="flex flex-col gap-1">
						<span class="font-medium">${escapeHtml(String(chain))}</span>
						<span>Net Flow: ${value > 0 ? '+' : ''}${formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
					</div>`
				}
			},
			grid: chartGrid(),
			xAxis: {
				type: 'value',
				position: 'top',
				splitLine: {
					lineStyle: {
						color: chartTheme.gridline,
						type: 'dashed'
					}
				},
				axisLabel: {
					formatter: (value) =>
						formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
					color: chartTheme.axisLabel
				}
			},
			yAxis: {
				type: 'category',
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false },
				data: chains,
				axisLabel: {
					color: chartTheme.axisLabel,
					fontSize: 13,
					padding: [0, 0, 0, 50]
				},
				offset: 30
			},
			series: [
				{
					name: 'Outflow',
					type: 'bar',
					stack: 'Total',
					data: negativeData,
					itemStyle: {
						color: chartTheme.down,
						borderRadius: [0, 4, 4, 0]
					},
					barWidth: '50%',
					label: {
						show: true,
						position: 'left',
						formatter: (params) => {
							const value = params.value
							return typeof value === 'number' && value !== 0
								? formatCompactNumber(value, {
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})
								: ''
						},
						backgroundColor: 'transparent',
						color: chartTheme.dataDown,
						fontSize: 12,
						fontWeight: 500
					}
				},
				{
					name: 'Inflow',
					type: 'bar',
					stack: 'Total',
					data: positiveData,
					itemStyle: {
						color: chartTheme.up,
						borderRadius: [4, 0, 0, 4]
					},
					barWidth: '50%',
					label: {
						show: true,
						position: 'right',
						formatter: (params) => {
							const value = params.value
							return typeof value === 'number' && value !== 0
								? formatCompactNumber(value, {
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})
								: ''
						},
						backgroundColor: 'transparent',
						color: chartTheme.dataUp,
						fontSize: 12,
						fontWeight: 500
					}
				}
			],
			dataset: {
				dimensions: ['Chain', 'Inflow', 'Outflow', 'Net Flow'],
				source: csvSource
			},
			graphic: canvasWatermarkEnabled ? chartWatermarkGraphic(instance, isThemeDark, 'under') : []
		}

		instance.setOption(option, { notMerge: true })
	}, [chains, positiveData, negativeData, isThemeDark, chartTheme, csvSource, canvasWatermarkEnabled])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		instance.resize()
		emitReady(instance)
		return () => emitReady(null)
	}, [])

	return (
		<div className="relative pr-5">
			<div ref={containerRef} className="my-auto" style={heightStyle ?? { minHeight: '600px' }} />
			<div className="m-4 flex justify-center">
				<SegmentedControl
					variant="default"
					size="md"
					options={PERIOD_OPTIONS}
					value={period}
					onValueChange={(next) => setPeriod(next)}
					label="Period"
				/>
			</div>
		</div>
	)
}

const PERIOD_OPTIONS: Array<SegmentedControlOption<BridgeNetflowPeriod>> = [
	{ value: 'day', label: 'Day' },
	{ value: 'week', label: 'Week' },
	{ value: 'month', label: 'Month' }
]

import type { EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { DatasetComponent, GraphicComponent, GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { BridgeNetflowPeriod } from '~/containers/Bridges/api.types'
import type { BridgeNetflowChartData } from '~/containers/Bridges/types'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { TagGroup } from '~/ui/SegmentedControl'
import { formatCompactNumber } from '~/utils/numberFormat'
import { chartGrid } from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { normalizeTooltipItems } from '../shared/tooltip'
import { buildNetflowBars } from './data'

echarts.use([BarChart, TooltipComponent, GridComponent, DatasetComponent, GraphicComponent, CanvasRenderer])

export interface NetflowChartProps {
	height?: number | string
	onReady?: (instance: echarts.ECharts | null) => void
	data: BridgeNetflowChartData
}

export default function NetflowChart({ height, onReady, data: allData }: NetflowChartProps) {
	const [isThemeDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isThemeDark)
	const [period, setPeriod] = useState<BridgeNetflowPeriod>('month')
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const hasAppliedInitialHeightRef = useRef(false)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	// Stable resize listener - never re-attaches when dependencies change
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
						<span class="font-medium">${chain}</span>
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
						color: '#ef4444',
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
						color: '#ef4444',
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
						color: '#22c55e',
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
						color: '#22c55e',
						fontSize: 12,
						fontWeight: 500
					}
				}
			],
			dataset: {
				dimensions: ['Chain', 'Inflow', 'Outflow', 'Net Flow'],
				source: csvSource
			},
			graphic: [
				{
					type: 'image',
					id: 'logo',
					left: 'center',
					top: 'center',
					style: {
						image: isThemeDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
						height: 40,
						opacity: 0.3
					},
					z: -1
				}
			]
		}

		instance.setOption(option, { notMerge: true })
	}, [chains, positiveData, negativeData, isThemeDark, chartTheme, csvSource])

	useEffect(() => {
		if (!hasAppliedInitialHeightRef.current) {
			hasAppliedInitialHeightRef.current = true
			return
		}
		chartRef.current?.resize()
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- height is the trigger, not an input: echarts re-measures the container after the new height renders.
	}, [height])

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
				<TagGroup variant="default" size="md" values={flowTypes} selectedValue={period} setValue={setPeriod} />
			</div>
		</div>
	)
}

const flowTypes = ['day', 'week', 'month'] as const

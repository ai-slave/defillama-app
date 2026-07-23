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
import { capitalizeFirstLetter, formattedNum } from '~/utils'
import { chartGrid } from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'

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

	const { positiveData, negativeData, chains, csvSource } = useMemo(() => {
		const data = allData[period]

		const positive: number[] = []
		const negative: number[] = []
		const chainNames: string[] = []
		const csvRows: Array<{ Chain: string; Inflow: number; Outflow: number; 'Net Flow': number }> = []
		for (const item of data) {
			const chain = capitalizeFirstLetter(item.chain)
			chainNames.push(chain)
			positive.push(item.value > 0 ? item.value : 0)
			negative.push(item.value < 0 ? item.value : 0)
			csvRows.push({
				Chain: chain,
				Inflow: item.value > 0 ? item.value : 0,
				Outflow: item.value < 0 ? Math.abs(item.value) : 0,
				'Net Flow': item.value
			})
		}

		return {
			positiveData: positive,
			negativeData: negative,
			chains: chainNames,
			csvSource: csvRows
		}
	}, [allData, period])

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
				formatter: function (params) {
					const chain = params[0].axisValue
					const value = (params[0].value || 0) + (params[1].value || 0)
					return `<div class="flex flex-col gap-1">
						<span class="font-medium">${chain}</span>
						<span>Net Flow: ${value > 0 ? '+' : ''}${formattedNum(value)}</span>
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
					formatter: (value) => formattedNum(value),
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
						formatter: (params) => (params.value !== 0 ? formattedNum(params.value) : ''),
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
						formatter: (params) => (params.value !== 0 ? formattedNum(params.value) : ''),
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
			<div ref={containerRef} className="my-auto" style={heightStyle ?? { minHeight: '600px' }}></div>
			<div className="m-4 flex justify-center">
				<TagGroup variant="default" size="md" values={flowTypes} selectedValue={period} setValue={setPeriod} />
			</div>
		</div>
	)
}

const flowTypes = ['day', 'week', 'month'] as const

import * as echarts from 'echarts/core'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { CHART_INSET, CHART_ZOOM_RESERVE, chartGrid } from '~/components/ECharts/chartSpacing'
import { useChartTheme } from '~/components/ECharts/chartTheme'
import type { ChartTimeGrouping, ChartTimeGroupingWithCumulative } from '~/components/ECharts/types'
import { useDefaults } from '~/components/ECharts/useDefaults'
import { mergeDeep } from '~/components/ECharts/utils'
import { useChartResize } from '~/hooks/useChartResize'
import { buildChainYAxis } from './chartYAxis'
import {
	BAR_CHARTS,
	type ChainChartLabels,
	chainOverviewChartColors,
	DISABLED_CUMULATIVE_CHARTS,
	yAxisByChart
} from './constants'
import type { ChainOverviewChartData } from './types'

const BAR_CHARTS_SET = new Set<ChainChartLabels>(BAR_CHARTS)
const DISABLED_CUMULATIVE_CHARTS_SET = new Set<ChainChartLabels>(DISABLED_CUMULATIVE_CHARTS)

interface ChainCoreChartProps {
	chartData: ChainOverviewChartData
	valueSymbol?: string
	color?: string
	chartOptions?: Record<string, Record<string, unknown>>
	height?: string
	unlockTokenSymbol?: string
	isThemeDark: boolean
	groupBy?: ChartTimeGroupingWithCumulative
	hideDataZoom?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
}

export default function ChainCoreChart({
	chartData,
	valueSymbol = '',
	color,
	chartOptions = {},
	height,
	unlockTokenSymbol = '',
	isThemeDark,
	groupBy,
	hideDataZoom = false,
	onReady
}: ChainCoreChartProps) {
	const isCumulative = groupBy === 'cumulative'
	const chartDomRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const tooltipGroupBy: ChartTimeGrouping = groupBy && groupBy !== 'cumulative' ? groupBy : 'daily'
	const chartTheme = useChartTheme(isThemeDark)

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, chartDomRef)

	const defaultChartSettings = useDefaults({
		color,
		valueSymbol,
		tooltipSort: false,
		hideLegend: true,
		unlockTokenSymbol,
		isThemeDark,
		chartTheme,
		groupBy: tooltipGroupBy
	})
	const chartSettings = useMemo(() => {
		const settings = { ...defaultChartSettings }
		for (const option in chartOptions) {
			if (settings[option]) {
				settings[option] = mergeDeep(settings[option], chartOptions[option])
			} else {
				settings[option] = { ...chartOptions[option] }
			}
		}
		return settings
	}, [defaultChartSettings, chartOptions])

	const { series, allYAxis, chartsInSeries } = useMemo(() => {
		const indexByYAxis = {} as Record<ChainChartLabels, number | undefined>
		const allYAxis: Array<[ChainChartLabels, number | undefined]> = []
		const chartsInSeries = new Set<ChainChartLabels>()
		const stacks: ChainChartLabels[] = []
		for (const stack in chartData) {
			const chartLabel = stack as ChainChartLabels
			const yAxis = yAxisByChart[chartLabel]
			stacks.push(chartLabel)
			chartsInSeries.add(chartLabel)
			if (!(yAxis in indexByYAxis)) {
				const yAxisIndex = allYAxis.length === 0 ? undefined : allYAxis.length
				indexByYAxis[yAxis] = yAxisIndex
				allYAxis.push([yAxis, yAxisIndex])
			}
		}

		const series = stacks.map((stack, index) => {
			const stackColor = chainOverviewChartColors[stack]
			const data = chartData[stack] ?? []

			let type = BAR_CHARTS_SET.has(stack) && !isCumulative ? 'bar' : 'line'
			type = DISABLED_CUMULATIVE_CHARTS_SET.has(stack) ? 'bar' : type

			const options = {
				yAxisIndex: indexByYAxis[yAxisByChart[stack]]
			}

			return {
				name: stack,
				type,
				...options,
				scale: true,
				large: data.length > 0,
				emphasis: {
					focus: 'series',
					shadowBlur: 10
				},
				symbol: 'none',
				itemStyle: {
					color: stackColor
				},
				...(type === 'line'
					? {
							areaStyle: {
								color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
									{
										offset: 0,
										color: stackColor ? stackColor : index === 0 ? chainOverviewChartColors[stack] : 'transparent'
									},
									{
										offset: 1,
										color: chartTheme.areaGradientTo
									}
								])
							}
						}
					: {}),
				markLine: {},
				data
			}
		})

		return { series, allYAxis, chartsInSeries }
	}, [chartData, chartTheme, isCumulative])

	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	useEffect(() => {
		const el = chartDomRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		emitReady(instance)

		return () => {
			chartRef.current = null
			instance.dispose()
			emitReady(null)
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const { graphic, tooltip, xAxis, yAxis, dataZoom } = chartSettings
		const finalYAxis = buildChainYAxis({
			allYAxis,
			baseYAxis: yAxis,
			chartColors: chainOverviewChartColors,
			chartsInSeries,
			themeText: chartTheme.text
		})

		instance.setOption(
			{
				graphic,
				tooltip,
				grid: chartGrid({ bottom: hideDataZoom ? CHART_INSET : CHART_ZOOM_RESERVE }),
				xAxis,
				yAxis: finalYAxis,
				dataZoom,
				series
			},
			{ notMerge: true, lazyUpdate: true }
		)
	}, [chartSettings, series, allYAxis, chartsInSeries, chartTheme.text, hideDataZoom])

	return <div ref={chartDomRef} className="h-[360px]" style={height ? { height } : undefined} />
}

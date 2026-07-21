import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts'
import { CustomChart } from 'echarts/charts'
import { MarkAreaComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { useDefaults } from '~/components/ECharts/LegacyChart/useDefaults'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	createEventStripYAxis,
	type EventHoverState,
	getMainGridBottom,
	getSeriesTimeBounds,
	mergeGraphicWithEventMarkLinePlaceholder
} from '~/components/ECharts/MultiSeriesChart/eventRail'
import type { ChartTimeGrouping } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { useChartResize } from '~/hooks/useChartResize'
import { useStableCallback } from '~/hooks/useStableCallback'
import { buildProtocolYAxis } from './chartYAxis'
import { BAR_CHARTS, type ProtocolChartsLabels, yAxisByChart } from './constants'
import type { IProtocolCoreChartProps } from './types'

echarts.use([MarkAreaComponent, CustomChart])

const PRIMARY_SERIES_ID_PREFIX = 'protocol-chart-series-'
const BAR_CHARTS_SET = new Set<ProtocolChartsLabels>(BAR_CHARTS)

export default function ProtocolChart({
	chartData,
	chartColors,
	valueSymbol = '',
	color,
	hallmarks,
	rangeHallmarks,
	chartOptions,
	height,
	unlockTokenSymbol = '',
	gasUsedValueSymbol,
	isThemeDark,
	groupBy,
	hideDataZoom = false,
	onReady
}: IProtocolCoreChartProps) {
	const isCumulative = groupBy === 'cumulative'
	const chartDomRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const eventHoverCleanupRef = useRef<(() => void) | null>(null)
	const eventHoverStateRef = useRef<EventHoverState>({ hoveredEventDate: null })
	const eventMarkLineGridRef = useRef<{ top: number; bottom: number } | null>(null)
	const tooltipGroupBy: ChartTimeGrouping = groupBy && groupBy !== 'cumulative' ? groupBy : 'daily'
	const chartTheme = useChartTheme(isThemeDark)
	const seriesValueSymbols = useMemo(
		() => (gasUsedValueSymbol ? { 'Gas Used': gasUsedValueSymbol } : undefined),
		[gasUsedValueSymbol]
	)

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, chartDomRef)

	const defaultChartSettings = useDefaults({
		color,
		valueSymbol,
		tooltipSort: false,
		hideLegend: true,
		unlockTokenSymbol: unlockTokenSymbol ?? '',
		seriesValueSymbols,
		isThemeDark,
		chartTheme,
		groupBy: tooltipGroupBy
	})
	const mergedChartSettings = useMemo(
		() => mergeDeep(defaultChartSettings, chartOptions),
		[defaultChartSettings, chartOptions]
	)

	const eventRailData = useMemo(
		() => buildEventRailData({ hallmarks, rangeHallmarks, isThemeDark, dateInMs: true }).events,
		[hallmarks, rangeHallmarks, isThemeDark]
	)

	const { series, allYAxis, chartsInSeries } = useMemo(() => {
		const indexByYAxis = {} as Record<ProtocolChartsLabels, number | undefined>
		const allYAxis: Array<[ProtocolChartsLabels, number | undefined]> = []
		const chartsInSeries = new Set<ProtocolChartsLabels>()
		const stacks: ProtocolChartsLabels[] = []
		for (const stack in chartData) {
			const chartLabel = stack as ProtocolChartsLabels
			const yAxis = yAxisByChart[chartLabel]
			stacks.push(chartLabel)
			chartsInSeries.add(chartLabel)
			if (!(yAxis in indexByYAxis)) {
				const yAxisIndex = allYAxis.length === 0 ? undefined : allYAxis.length
				indexByYAxis[yAxis] = yAxisIndex
				allYAxis.push([yAxis, yAxisIndex])
			}
		}

		const series: Array<BarSeriesOption | LineSeriesOption> = stacks.map((stack, index) => {
			const stackColor = chartColors[stack]
			const type = BAR_CHARTS_SET.has(stack) && !isCumulative ? 'bar' : 'line'
			const data = chartData[stack] ?? []

			const common = {
				id: `${PRIMARY_SERIES_ID_PREFIX}${index}`,
				name: stack,
				yAxisIndex: indexByYAxis[yAxisByChart[stack]],
				emphasis: { focus: 'series' as const },
				itemStyle: {
					color: stackColor || undefined
				},
				data,
				...(index === 0 && (rangeHallmarks?.length ?? 0) > 0
					? {
							markArea: {
								itemStyle: {
									color: isThemeDark ? 'rgba(15, 52, 105, 0.4)' : 'rgba(70, 130, 180, 0.3)'
								},
								label: {
									fontFamily: 'sans-serif',
									fontWeight: 600,
									color: chartTheme.text
								},
								data: (rangeHallmarks ?? []).map(
									([date, event]: [[number, number], string]): [{ name: string; xAxis: number }, { xAxis: number }] => [
										{ name: event, xAxis: date[0] },
										{ xAxis: date[1] }
									]
								)
							}
						}
					: {})
			}
			if (type === 'bar') return { ...common, type: 'bar', large: data.length > 0 }
			return {
				...common,
				type: 'line',
				symbol: 'none',
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{
							offset: 0,
							color: stackColor ? stackColor : index === 0 ? chartColors[stack] : 'transparent'
						},
						{ offset: 1, color: chartTheme.areaGradientTo }
					])
				}
			}
		})

		return {
			series,
			allYAxis,
			chartsInSeries
		}
	}, [chartData, chartColors, chartTheme, isThemeDark, isCumulative, rangeHallmarks])

	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})
	const getEventMarkLineShape = useStableCallback((eventDate: number) => {
		const instance = chartRef.current
		const grid = eventMarkLineGridRef.current
		if (!instance || instance.isDisposed() || !grid) return null
		const x = instance.convertToPixel({ xAxisIndex: 0 }, eventDate)
		if (!Number.isFinite(x)) return null

		return {
			x1: x,
			y1: grid.top,
			x2: x,
			y2: instance.getHeight() - grid.bottom
		}
	})

	useEffect(() => {
		const el = chartDomRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		emitReady(instance)

		return () => {
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
			eventMarkLineGridRef.current = null
			chartRef.current = null
			instance.dispose()
			emitReady(null)
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const { graphic, tooltip, xAxis, yAxis, dataZoom } = mergedChartSettings

		const finalYAxis = buildProtocolYAxis({
			allYAxis,
			baseYAxis: yAxis,
			chartColors,
			chartsInSeries,
			unlockTokenSymbol,
			gasUsedValueSymbol: gasUsedValueSymbol ?? valueSymbol
		})

		const shouldHideDataZoom = hideDataZoom || series.every((s) => s.data.length < 2)
		const shouldShowEventRail = eventRailData.length > 0

		let timeRangeMin = Infinity
		let timeRangeMax = -Infinity
		if (shouldShowEventRail) {
			for (const s of series) {
				const data = (s.data ?? []) as Array<[number, number] | unknown>
				const { min, max } = getSeriesTimeBounds(data)
				if (typeof min === 'number' && min < timeRangeMin) timeRangeMin = min
				if (typeof max === 'number' && max > timeRangeMax) timeRangeMax = max
			}
		}
		const hasTimeRange = Number.isFinite(timeRangeMin) && Number.isFinite(timeRangeMax) && timeRangeMin < timeRangeMax

		const mainGridBottom = getMainGridBottom({ shouldShowEventRail, shouldHideDataZoom })

		const mainGrid = chartGrid({
			bottom: mainGridBottom,
			top: (rangeHallmarks?.length ?? 0) > 0 ? 18 : CHART_INSET
		})
		eventMarkLineGridRef.current = shouldShowEventRail ? { top: Number(mainGrid.top), bottom: mainGridBottom } : null
		const finalGrid = mainGrid
		const finalXAxis = shouldShowEventRail && hasTimeRange ? { ...xAxis, min: timeRangeMin, max: timeRangeMax } : xAxis

		const eventStripYAxis = createEventStripYAxis()
		const eventStripYAxisIndex = finalYAxis.length
		const finalYAxisWithEvents = shouldShowEventRail ? [...finalYAxis, eventStripYAxis] : finalYAxis
		const finalDataZoom = dataZoom
		const finalSeries = shouldShowEventRail
			? [
					...series,
					createEventRailSeries({
						eventRailData,
						eventStripYAxisIndex,
						hoverState: eventHoverStateRef.current,
						shouldHideDataZoom,
						tooltipGroupBy
					})
				]
			: series

		const finalGraphic = shouldShowEventRail ? mergeGraphicWithEventMarkLinePlaceholder(graphic, isThemeDark) : graphic

		const option: EChartsOption = {
			graphic: finalGraphic,
			tooltip,
			grid: finalGrid,
			xAxis: finalXAxis,
			yAxis: finalYAxisWithEvents,
			...(shouldHideDataZoom ? {} : { dataZoom: finalDataZoom }),
			series: finalSeries
		}
		instance.setOption(option, { notMerge: true, lazyUpdate: true })
	}, [
		mergedChartSettings,
		series,
		unlockTokenSymbol,
		chartColors,
		allYAxis,
		chartsInSeries,
		rangeHallmarks,
		eventRailData,
		isThemeDark,
		tooltipGroupBy,
		hideDataZoom,
		gasUsedValueSymbol,
		valueSymbol
	])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		eventHoverCleanupRef.current?.()
		eventHoverStateRef.current.hoveredEventDate = null
		eventHoverCleanupRef.current = attachEventHoverHandlers({
			instance,
			eventRailData,
			hoverState: eventHoverStateRef.current,
			getEventMarkLineShape
		})

		return () => {
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
		}
	}, [eventRailData, getEventMarkLineShape])

	return <div ref={chartDomRef} className="h-[360px]" style={height ? { height } : undefined} />
}

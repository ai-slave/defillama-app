import * as echarts from 'echarts/core'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useStableCallback } from '~/hooks/useStableCallback'
import { ChartContainer } from '../ChartContainer'
import { CHART_INSET, CHART_ZOOM_RESERVE, chartGrid, chartHorizontalScrollLegend } from '../chartSpacing'
import { useChartTheme } from '../chartTheme'
import { formatTooltipValue } from '../formatters'
import { getMetricUnitGroup, METRIC_UNIT_GROUP_SYMBOL, resolveSeriesAxisLayout } from '../metricGroups'
import type { IMultiSeriesChartProps } from '../types'
import { useDefaults } from '../useDefaults'
import { isIconUrlValid, mergeDeep, validateIconUrl } from '../utils'

const EMPTY_ARRAY = []

export default function MultiSeriesChart({
	series,
	valueSymbol = '',
	yAxisSymbols = EMPTY_ARRAY,
	height,
	chartOptions,
	groupBy,
	hideDataZoom = false,
	alwaysShowTooltip,
	xAxisType = 'time',
	showAggregateInTooltip = false,
	onReady
}: IMultiSeriesChartProps) {
	const [isThemeDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isThemeDark)
	const [logoRevision, setLogoRevision] = useState(0)
	const axisLayout = useMemo(() => resolveSeriesAxisLayout(series ?? []), [series])
	const seriesValueSymbols = useMemo(() => {
		const symbols = Object.create(null) as Record<string, string>
		for (let i = 0; i < (series?.length ?? 0); i++) {
			const item = series![i]
			const axisIndex = axisLayout.seriesAxisIndexes[i] ?? 0
			symbols[item.name] =
				yAxisSymbols[axisIndex] ??
				(item.metricType ? METRIC_UNIT_GROUP_SYMBOL[getMetricUnitGroup(item.metricType)] : valueSymbol)
		}
		return symbols
	}, [axisLayout.seriesAxisIndexes, series, valueSymbol, yAxisSymbols])

	useEffect(() => {
		const urls = (series ?? []).map((s) => s.logo).filter((u): u is string => !!u)
		if (urls.length === 0) return
		let cancelled = false
		Promise.all(urls.map(validateIconUrl)).then(() => {
			if (!cancelled) setLogoRevision((v) => v + 1)
		})
		return () => {
			cancelled = true
		}
	}, [series])

	const defaultChartSettings = useDefaults({
		valueSymbol,
		xAxisType,
		groupBy: groupBy ?? 'daily',
		isThemeDark,
		chartTheme,
		alwaysShowTooltip,
		seriesValueSymbols
	})
	// Keep presentation overrides stable while only the series data changes.
	const chartSettings = useMemo(() => {
		const settings: Record<string, any> = { ...defaultChartSettings }
		const options = chartOptions ?? {}
		for (const option in options) {
			const optionValue = options[option]
			if (!optionValue) continue
			if (option === 'overrides') {
				settings['tooltip'] = { ...settings['inflowsTooltip'] }
			} else if (option === 'dataZoom' && Array.isArray(optionValue)) {
				if (settings[option]) {
					settings[option] = [
						{ ...settings[option][0], ...(optionValue[0] ?? {}) },
						{ ...settings[option][1], ...(optionValue[1] ?? {}) }
					]
				} else {
					settings[option] = optionValue
				}
			} else if (settings[option]) {
				settings[option] = mergeDeep(settings[option], optionValue)
			} else {
				settings[option] = Array.isArray(optionValue) ? optionValue : { ...optionValue }
			}
		}

		const tooltipOptions = options.tooltip
		if (showAggregateInTooltip && !Array.isArray(tooltipOptions) && !tooltipOptions?.formatter) {
			settings.tooltip = {
				...settings.aggregateTooltip
			}
		}

		return settings
	}, [defaultChartSettings, chartOptions, showAggregateInTooltip])

	const processedSeries = useMemo(() => {
		void logoRevision
		return (
			series?.map((serie: any) => {
				const serieConfig: any = {
					name: serie.name,
					type: serie.type,
					symbol: serie.type === 'line' ? 'none' : undefined,
					emphasis: {
						focus: 'series',
						shadowBlur: 10
					},
					itemStyle: {
						color: serie.color
					},
					data:
						serie.data?.map(([x, y]: [number | string, number | null]) =>
							xAxisType === 'time' ? [+x * 1e3, y] : [x, y]
						) || [],
					metricType: serie.metricType,
					yAxisIndex: serie.yAxisIndex,
					...(serie.logo &&
						isIconUrlValid(serie.logo) && {
							legendIcon: 'image://' + serie.logo
						}),
					...(serie.stack && {
						stack: serie.stack
					})
				}

				if (serie.type === 'line' && !serie.areaStyle) {
					serieConfig.areaStyle = {
						color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
							{
								offset: 0,
								color: serie.color
							},
							{
								offset: 1,
								color: chartTheme.areaGradientTo
							}
						])
					}
				} else if (serie.areaStyle !== undefined) {
					serieConfig.areaStyle = serie.areaStyle
				}

				return serieConfig
			}) || []
		)
	}, [series, chartTheme, xAxisType, logoRevision])

	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const latestTooltipDataIndexRef = useRef<number | null>(null)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})
	const showLatestTooltip = useStableCallback(() => {
		const instance = chartRef.current
		const dataIndex = latestTooltipDataIndexRef.current
		if (!instance || instance.isDisposed() || dataIndex == null) return
		instance.dispatchAction({
			type: 'showTip',
			seriesIndex: 0,
			dataIndex,
			position: [60, 0]
		})
	})

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		emitReady(instance)
		instance.on('globalout', showLatestTooltip)

		return () => {
			instance.off('globalout', showLatestTooltip)
			chartRef.current = null
			latestTooltipDataIndexRef.current = null
			instance.dispose()
			emitReady(null)
		}
	}, [showLatestTooltip])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const { graphic, tooltip, xAxis, yAxis, dataZoom, legend, grid, series: seriesOptions } = chartSettings
		const { needMultipleAxes, axisCount, axisUnitGroups, seriesAxisIndexes } = axisLayout

		let finalYAxis: any = yAxis
		let seriesWithHallmarks = processedSeries

		if (needMultipleAxes) {
			const yAxisBase = yAxis && typeof yAxis === 'object' ? (Array.isArray(yAxis) ? yAxis[0] || {} : yAxis) : {}
			const yAxisAxisLabel = yAxisBase.axisLabel && typeof yAxisBase.axisLabel === 'object' ? yAxisBase.axisLabel : {}
			const existingFormatter =
				typeof yAxisAxisLabel.formatter === 'function' || typeof yAxisAxisLabel.formatter === 'string'
					? yAxisAxisLabel.formatter
					: null
			finalYAxis = Array.from({ length: axisCount }, (_, index) => {
				const axisGroup = axisUnitGroups[index]
				const fallbackSymbol = axisGroup != null ? METRIC_UNIT_GROUP_SYMBOL[axisGroup] : valueSymbol
				return {
					...yAxisBase,
					axisLabel: {
						...yAxisAxisLabel,
						margin: 4,
						formatter:
							index === 0 && existingFormatter
								? existingFormatter
								: (value: number) => formatTooltipValue(value, yAxisSymbols[index] ?? fallbackSymbol)
					},
					position: index === 0 ? 'left' : index === 1 ? 'right' : 'left',
					offset: index === 2 ? 40 : 0
				}
			})

			seriesWithHallmarks = seriesWithHallmarks.map((s: any, index: number) => ({
				...s,
				yAxisIndex: seriesAxisIndexes[index]
			}))
		}

		if (seriesOptions) {
			seriesWithHallmarks = seriesWithHallmarks.map((item: any, index: number) =>
				mergeDeep(item, Array.isArray(seriesOptions) ? (seriesOptions[index] ?? {}) : seriesOptions)
			)
		}

		const gridLeftPadding = CHART_INSET

		const shouldHideDataZoom = seriesWithHallmarks.every((s: any) => s.data.length < 2) || hideDataZoom

		instance.setOption(
			{
				graphic,
				tooltip:
					showAggregateInTooltip && !alwaysShowTooltip
						? {
								...tooltip,
								position: function (pos: [number, number], params: any, dom: any, rect: any, size: any) {
									const tooltipWidth = size.contentSize[0]
									const tooltipHeight = size.contentSize[1]
									const chartWidth = size.viewSize[0]
									const chartHeight = size.viewSize[1]

									// If tooltip would be cut off at bottom, position it above the cursor
									if (pos[1] + tooltipHeight > chartHeight - 50) {
										return [Math.min(pos[0], chartWidth - tooltipWidth - 10), Math.max(10, pos[1] - tooltipHeight - 10)]
									}

									// Otherwise use default position
									return pos
								}
							}
						: tooltip,
				grid: {
					...chartGrid({ left: gridLeftPadding, bottom: shouldHideDataZoom ? CHART_INSET : CHART_ZOOM_RESERVE }),
					...grid
				},
				xAxis,
				yAxis: finalYAxis,
				legend: {
					...chartHorizontalScrollLegend(legend),
					data: series?.map((s: any) => s.name) || []
				},
				dataZoom: shouldHideDataZoom ? [] : [...dataZoom],
				series: seriesWithHallmarks
			},
			{ replaceMerge: ['series', 'yAxis', 'dataZoom'] }
		)

		if (alwaysShowTooltip && seriesWithHallmarks.length > 0 && seriesWithHallmarks[0].data.length > 0) {
			latestTooltipDataIndexRef.current = seriesWithHallmarks[0].data.length - 1
			showLatestTooltip()
		} else {
			latestTooltipDataIndexRef.current = null
		}
	}, [
		chartSettings,
		axisLayout,
		processedSeries,
		hideDataZoom,
		alwaysShowTooltip,
		series,
		showAggregateInTooltip,
		showLatestTooltip,
		valueSymbol,
		yAxisSymbols
	])

	return (
		<ChartContainer
			chartRef={containerRef}
			chartClassName="my-auto h-[360px]"
			chartStyle={height ? { height } : undefined}
		/>
	)
}

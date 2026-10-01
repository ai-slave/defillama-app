import type { EChartsOption } from 'echarts'
import { ScatterChart as EChartScatter, type ScatterSeriesOption } from 'echarts/charts'
import {
	AxisPointerComponent,
	BrushComponent,
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	TitleComponent,
	ToolboxComponent,
	TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { formatUsd, formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { CHART_INSET } from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { useLoadedIconUrls } from '../shared/icon'
import type {
	IScatterChartProps,
	ScatterChartDatum,
	ScatterChartPoint,
	ScatterChartValue,
	ScatterTooltipParams
} from './types'
import { groupYieldScatterPoints, isYieldScatterChartPoint } from './yieldPoints'

echarts.use([
	CanvasRenderer,
	EChartScatter,
	TooltipComponent,
	ToolboxComponent,
	TitleComponent,
	GridComponent,
	GraphicComponent,
	AxisPointerComponent,
	BrushComponent,
	LegendComponent,
	DataZoomComponent
])

const getEntityIcon = (type: string, slug: string) => {
	if (type === 'chain') return chainIconUrl(slug)
	return tokenIconUrl(slug)
}

function isScatterChartPoint(point: ScatterChartDatum): point is ScatterChartPoint {
	return !Array.isArray(point) && 'value' in point
}

function getPointValue(point: ScatterChartDatum): ScatterChartValue {
	if (Array.isArray(point)) return point
	return isScatterChartPoint(point) ? point.value : [Number.NaN, Number.NaN]
}

function isScatterTooltipParams(value: unknown): value is Partial<ScatterTooltipParams> {
	return value !== null && typeof value === 'object'
}

function normalizeScatterTooltipParams(params: unknown): ScatterTooltipParams {
	if (!isScatterTooltipParams(params)) return { value: [Number.NaN, Number.NaN] }
	const candidate = params
	const rawValue = candidate.value
	const value: ScatterChartValue = [
		typeof rawValue?.[0] === 'number' ? rawValue[0] : Number(rawValue?.[0]),
		typeof rawValue?.[1] === 'number' ? rawValue[1] : Number(rawValue?.[1]),
		...(rawValue?.slice(2) ?? [])
	]
	return {
		...candidate,
		value
	}
}

function ScatterChart({
	chartData,
	title,
	xAxisLabel,
	yAxisLabel,
	valueSymbol = '',
	height = '600px',
	tooltipFormatter,
	showLabels = false,
	entityType = 'protocol',
	logScale = false,
	onReady
}: IScatterChartProps) {
	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	const iconUrls = new Set<string>()
	if (showLabels) {
		for (const point of chartData) {
			if (isScatterChartPoint(point) && point.showLabel === false) continue
			const slug = (isScatterChartPoint(point) ? point.entitySlug : undefined) ?? getPointValue(point)[3]
			if (slug && typeof slug === 'string' && slug.toLowerCase() !== 'unknown')
				iconUrls.add(getEntityIcon(entityType, slug))
		}
	}
	const loadedIcons = useLoadedIconUrls([...iconUrls])

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

		const series: Array<ScatterSeriesOption> = []
		const isYieldData = chartData[0] != null && isYieldScatterChartPoint(chartData[0])

		const labelConfig = {
			show: showLabels,
			position: 'right' as const,
			distance: 5,
			formatter: (params: unknown) => String(normalizeScatterTooltipParams(params).value[2] ?? ''),
			fontSize: 10,
			fontWeight: 500,
			color: chartTheme.ink(0.86)
		}

		if (isYieldData) {
			const pointsByProject = groupYieldScatterPoints(chartData)
			for (const [project, data] of pointsByProject) {
				series.push({
					name: project,
					type: 'scatter',
					symbolSize: 5,
					large: true,
					emphasis: {
						focus: 'series'
					},
					label: labelConfig,
					data
				})
			}
		} else {
			const groupedData = new Map<string, { data: Array<ScatterChartValue | ScatterChartPoint>; groupColor?: string }>()
			for (const inputPoint of chartData) {
				if (isYieldScatterChartPoint(inputPoint)) continue
				let point: ScatterChartValue | ScatterChartPoint = inputPoint
				if (showLabels) {
					const normalizedPoint = Array.isArray(point) ? { value: point } : point
					point = normalizedPoint
					if (normalizedPoint.showLabel !== false) {
						const slug = normalizedPoint.entitySlug ?? normalizedPoint.value[3] ?? ''
						if (typeof slug === 'string' && slug && slug.toLowerCase() !== 'unknown') {
							const url = getEntityIcon(entityType, slug)
							if (loadedIcons.has(url)) {
								point = {
									...normalizedPoint,
									symbol: `image://${url}`,
									symbolSize: Math.max(normalizedPoint.symbolSize ?? 20, 18)
								}
							}
						}
					}
				}

				const seriesName = isScatterChartPoint(point) && point.seriesName ? point.seriesName : title || 'Data'
				let group = groupedData.get(seriesName)
				if (!group) {
					group = { data: [] }
					groupedData.set(seriesName, group)
				}
				group.data.push(point)
				if (group.groupColor == null && isScatterChartPoint(point) && typeof point.groupColor === 'string') {
					group.groupColor = point.groupColor
				}
			}

			for (const [seriesName, group] of groupedData) {
				series.push({
					name: seriesName,
					type: 'scatter',
					symbolSize: showLabels ? 20 : 8,
					itemStyle: {
						...(group.groupColor ? { color: group.groupColor } : {}),
						opacity: 0.84
					},
					emphasis: {
						focus: 'series',
						scale: true,
						label: { show: true },
						itemStyle: {
							opacity: 1,
							borderColor: chartTheme.ink(0.9),
							borderWidth: 2
						}
					},
					label: labelConfig,
					data: group.data
				})
			}
		}

		const showCategoricalLegend = !isYieldData && series.length > 1

		const yieldTooltipFormatter = (params: ScatterTooltipParams) => {
			if (params.value.length > 1) {
				const apy =
					typeof params.value[6] === 'number'
						? formatNumber(params.value[6], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
						: '—'
				const average =
					typeof params.value[1] === 'number'
						? formatNumber(params.value[1], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
						: '—'
				const deviation =
					typeof params.value[0] === 'number'
						? formatNumber(params.value[0], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
						: '—'
				return (
					`Symbol: ${params.value[3]}<br/>` +
					`Pool: ${params.value[4]}<br/>` +
					`TVL: ${formatUsd(params.value[5], {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}<br/>` +
					`APY Spot: ${apy}%` +
					`<br/>` +
					`Chain: ${params.value[7]}<br/>` +
					`Project: ${params.seriesName}<br/>` +
					`APY Geometric Average: ${average}%` +
					`<br/>` +
					`APY Standard Deviation: ${deviation}%` +
					`<br/>` +
					`Nb of collected daily datapoints: ${params.value[2]}`
				)
			}
			return `${params.seriesName} :<br/>${params.name}`
		}

		const genericTooltipFormatter = (params: ScatterTooltipParams) => {
			if (params.value && params.value.length >= 2) {
				const xValue = params.value[0]
				const yValue = params.value[1]
				const entityName = params.value[2]
				const formatValue = (val: string | number | null | undefined) => {
					const numericValue = typeof val === 'number' ? val : Number(val)
					if (!Number.isFinite(numericValue)) return '—'
					if (valueSymbol === '$')
						return formatUsd(numericValue, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					if (valueSymbol === '%')
						return formatPercent(numericValue, {
							input: 'percent',
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
							useGrouping: false
						})
					return formatCompactNumber(numericValue, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				}
				let tooltip = ''
				if (entityName) {
					tooltip += `<strong>${entityName}</strong><br/>`
				}
				tooltip += `${xAxisLabel || 'X'}: ${formatValue(xValue)}<br/>`
				tooltip += `${yAxisLabel || 'Y'}: ${formatValue(yValue)}`
				return tooltip
			}
			return ''
		}

		const effectiveTooltipFormatter =
			tooltipFormatter || (isYieldData ? yieldTooltipFormatter : genericTooltipFormatter)

		const option: EChartsOption = {
			grid: {
				top: showCategoricalLegend ? 40 : CHART_INSET,
				right: CHART_INSET,
				bottom: CHART_INSET,
				left: CHART_INSET,
				outerBoundsMode: 'same'
			},
			tooltip: {
				showDelay: 0,
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				confine: true,
				formatter: (params: unknown) => effectiveTooltipFormatter(normalizeScatterTooltipParams(params)),
				axisPointer: {
					show: true,
					type: 'cross',
					lineStyle: {
						type: 'dashed',
						width: 1
					}
				}
			},
			toolbox: {
				feature: {
					dataZoom: {},
					restore: {}
				}
			},
			xAxis: [
				{
					type: logScale ? 'log' : 'value',
					scale: true,
					name: xAxisLabel || '',
					nameLocation: 'middle',
					nameGap: 28,
					nameTextStyle: {
						fontFamily: 'sans-serif',
						fontSize: 14,
						fontWeight: 500
					},
					axisLabel: {
						formatter: '{value}',
						color: chartTheme.axisLabel,
						inside: false,
						margin: 8
					},
					splitLine: {
						lineStyle: {
							color: chartTheme.gridline
						}
					}
				}
			],
			yAxis: [
				{
					type: logScale ? 'log' : 'value',
					scale: true,
					name: yAxisLabel || '',
					nameLocation: 'middle',
					nameGap: 36,
					nameTextStyle: {
						fontFamily: 'sans-serif',
						fontSize: 14,
						fontWeight: 500
					},
					axisLabel: {
						formatter: '{value}',
						color: chartTheme.axisLabel,
						inside: false,
						margin: 8
					},
					splitLine: {
						lineStyle: {
							color: chartTheme.gridline
						}
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
			labelLayout: { hideOverlap: true },
			series
		}
		if (title) {
			option.title = {
				text: title,
				textStyle: {
					fontFamily: 'sans-serif',
					fontWeight: 600,
					color: chartTheme.text
				}
			}
		}
		if (showCategoricalLegend) {
			option.legend = {
				type: 'scroll',
				top: 0,
				left: CHART_INSET,
				right: 108,
				itemWidth: 10,
				itemHeight: 10,
				textStyle: {
					fontFamily: 'sans-serif',
					fontSize: 11,
					color: chartTheme.text
				}
			}
		}

		instance.setOption(option, { notMerge: true })
	}, [
		chartData,
		chartTheme,
		tooltipFormatter,
		xAxisLabel,
		yAxisLabel,
		valueSymbol,
		title,
		showLabels,
		entityType,
		logScale,
		loadedIcons
	])

	return (
		<div>
			<div ref={containerRef} className="h-[360px]" style={height ? { height } : undefined} />
		</div>
	)
}

export default withEChartsRenderVisibility(ScatterChart)

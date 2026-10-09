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
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
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
	domain,
	pinnableTooltip = false,
	onReady
}: IScatterChartProps) {
	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const pinnedPointRef = useRef<{ seriesIndex: number; dataIndex: number } | null>(null)
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
		if (!pinnableTooltip || !instance) return
		const showPinned = () => {
			const pinned = pinnedPointRef.current
			if (pinned && !instance.isDisposed()) instance.dispatchAction({ type: 'showTip', ...pinned })
		}
		// Hovering another point, crossing empty plot space on the way to the tooltip's links, or leaving the chart hides
		// the tooltip, so the pinned one comes back after it.
		const restorePinned = () => {
			if (pinnedPointRef.current) requestAnimationFrame(showPinned)
		}
		const restoreOverEmptySpace = (event: { target?: unknown }) => {
			if (!event.target) restorePinned()
		}
		// A click on empty plot space unpins, like a click outside the chart.
		const unpinOnEmptyClick = (event: { target?: unknown }) => {
			if (!event.target && pinnedPointRef.current) unpin()
		}
		const unpin = () => {
			pinnedPointRef.current = null
			instance.dispatchAction({ type: 'hideTip' })
		}
		const handleClick = (params: { componentType?: string; seriesIndex?: number; dataIndex?: number }) => {
			if (params.componentType !== 'series' || params.seriesIndex == null || params.dataIndex == null) return
			const pinned = pinnedPointRef.current
			if (pinned?.seriesIndex === params.seriesIndex && pinned.dataIndex === params.dataIndex) {
				unpin()
				return
			}
			pinnedPointRef.current = { seriesIndex: params.seriesIndex, dataIndex: params.dataIndex }
			showPinned()
		}
		const handlePointerDown = (event: PointerEvent) => {
			if (pinnedPointRef.current && !containerRef.current?.contains(event.target as Node)) unpin()
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && pinnedPointRef.current) unpin()
		}
		const renderer = instance.getZr()
		instance.on('click', handleClick)
		instance.on('mouseover', restorePinned)
		renderer.on('globalout', restorePinned)
		renderer.on('mousemove', restoreOverEmptySpace)
		renderer.on('click', unpinOnEmptyClick)
		document.addEventListener('pointerdown', handlePointerDown)
		window.addEventListener('keydown', handleKeyDown)
		return () => {
			pinnedPointRef.current = null
			document.removeEventListener('pointerdown', handlePointerDown)
			window.removeEventListener('keydown', handleKeyDown)
			if (instance.isDisposed()) return
			instance.off('click', handleClick)
			instance.off('mouseover', restorePinned)
			renderer.off('globalout', restorePinned)
			renderer.off('mousemove', restoreOverEmptySpace)
			renderer.off('click', unpinOnEmptyClick)
		}
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- persistentLifecycle is the trigger: the instance these listeners attach to is recreated with it.
	}, [pinnableTooltip, persistentLifecycle])

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
					`Symbol: ${escapeHtml(String(params.value[3]))}<br/>` +
					`Pool: ${escapeHtml(String(params.value[4]))}<br/>` +
					`TVL: ${formatUsd(params.value[5], {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}<br/>` +
					`APY Spot: ${apy}%` +
					`<br/>` +
					`Chain: ${escapeHtml(String(params.value[7]))}<br/>` +
					`Project: ${escapeHtml(String(params.seriesName))}<br/>` +
					`APY Geometric Average: ${average}%` +
					`<br/>` +
					`APY Standard Deviation: ${deviation}%` +
					`<br/>` +
					`Nb of collected daily datapoints: ${params.value[2]}`
				)
			}
			return `${escapeHtml(String(params.seriesName))} :<br/>${escapeHtml(String(params.name))}`
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
					tooltip += `<strong>${escapeHtml(String(entityName))}</strong><br/>`
				}
				tooltip += `${escapeHtml(xAxisLabel || 'X')}: ${formatValue(xValue)}<br/>`
				tooltip += `${escapeHtml(yAxisLabel || 'Y')}: ${formatValue(yValue)}`
				return tooltip
			}
			return ''
		}

		const effectiveTooltipFormatter =
			tooltipFormatter || (isYieldData ? yieldTooltipFormatter : genericTooltipFormatter)

		const valueAxisRange = domain
			? { type: 'value' as const, min: domain[0], max: domain[1] }
			: { type: logScale ? ('log' as const) : ('value' as const), scale: true }

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
				// ECharts already triggers on mousemove and click; a pinned tooltip needs to take the pointer for its links.
				...(pinnableTooltip ? { enterable: true } : {}),
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
			xAxis: [
				{
					...valueAxisRange,
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
					...valueAxisRange,
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
			// A fixed domain is a map with fixed bounds, so it neither zooms nor shows the zoom toolbox.
			...(domain
				? {}
				: {
						toolbox: { feature: { dataZoom: {}, restore: {} } },
						dataZoom: [{ type: 'inside', start: 0, end: 100, filterMode: 'none' }]
					}),
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
		// Replacing the option hides the tooltip; a pinned point that is still drawn keeps its tooltip open.
		const pinned = pinnedPointRef.current
		const pinnedSeriesData = pinned ? series[pinned.seriesIndex]?.data : undefined
		if (pinned && Array.isArray(pinnedSeriesData) && pinned.dataIndex < pinnedSeriesData.length) {
			instance.dispatchAction({ type: 'showTip', ...pinned })
		} else {
			pinnedPointRef.current = null
		}
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
		domain,
		pinnableTooltip,
		loadedIcons
	])

	return <div ref={containerRef} className="h-[360px]" style={height ? { height } : undefined} />
}

export default withEChartsRenderVisibility(ScatterChart)

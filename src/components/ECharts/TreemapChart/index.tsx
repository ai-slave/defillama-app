import type { ComposeOption, GraphicComponentOption, ToolboxComponentOption, TooltipComponentOption } from 'echarts'
import { TreemapChart as EChartTreemap, type TreemapSeriesOption } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { TreemapLabelContrast } from '~/components/ECharts/TreemapChart/labelContrast'
import { CHART_COLORS } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { CHART_INSET } from '../shared/chartSpacing'
import { getChartTheme } from '../shared/chartTheme'
import { escapeHtml } from '../shared/escapeHtml'
import { formatChartValue } from '../shared/formatters'
import { buildWatermarkGraphic, useCanvasWatermarkEnabled } from '../shared/watermark'
import { clearTreemapFocus, registerTreemapFocusTracking } from './focus'
import { formatNarrativeTreemapLabel, formatNarrativeTreemapTooltip } from './formatters'
import { formatRwaTreemapTooltip } from './rwaFormatting'
import type { TreemapChartProps, TreemapNode, TreemapValue } from './types'

type TreemapPathInfo = Array<{ name?: unknown }>
type TreemapFormatterParams = {
	data?: unknown
	treePathInfo?: TreemapPathInfo
	value: TreemapValue
	name?: unknown
}

type CanonicalTreemapSeriesOption = Omit<TreemapSeriesOption, 'data'> & { data: Array<TreemapNode> }
type TreemapOption = ComposeOption<
	CanonicalTreemapSeriesOption | GraphicComponentOption | ToolboxComponentOption | TooltipComponentOption
>

function isTreemapFormatterParams(value: unknown): value is TreemapFormatterParams {
	return value !== null && typeof value === 'object' && 'value' in value && isTreemapValue(value.value)
}

function isTreemapValue(value: unknown): value is TreemapValue {
	if (!Array.isArray(value) || typeof value[0] !== 'number') return false
	const secondary = value[1]
	const color = value[2]
	const change = value[3]
	return (
		(secondary === null || typeof secondary === 'number') &&
		(color === null || typeof color === 'number') &&
		(change == null || typeof change === 'number')
	)
}

function isTreemapNode(value: unknown): value is TreemapNode {
	return (
		value !== null &&
		typeof value === 'object' &&
		'name' in value &&
		typeof value.name === 'string' &&
		'value' in value &&
		isTreemapValue(value.value)
	)
}

echarts.use([TreemapLabelContrast, TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer, GraphicComponent])

function TreemapChart({
	treeData,
	variant,
	colorMode = 'value',
	height,
	containerClassName,
	onReady,
	showRootLabel = true,
	valueLabel = 'Market cap',
	valueSymbol = '$'
}: TreemapChartProps) {
	const isNarrativeVariant = variant === 'narrative'
	const isRwaVariant = variant === 'rwa'
	const isFlatVariant = variant === 'flat'
	const isCategoricalColor = colorMode === 'categorical'

	const canvasWatermarkEnabled = useCanvasWatermarkEnabled()
	const [isDark] = useDarkModeManager()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	// Observes the container, so a new height resizes the chart too
	useChartResize(chartRef, containerRef)

	const chartTheme = useMemo(() => getChartTheme(isDark), [isDark])
	const formatTreemapMetricValue = useCallback(
		(value: number) => formatChartValue(value, valueSymbol ?? ''),
		[valueSymbol]
	)

	const rwaRootLabel = useMemo(() => {
		if (!isRwaVariant) return 'All'
		for (const node of treeData) {
			const path = node.path ?? ''
			const root = path.split('/')[0]?.trim()
			if (root) return root
		}
		return 'RWA'
	}, [treeData, isRwaVariant])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		emitReady(instance)

		const unregisterTreemapFocus = registerTreemapFocusTracking(instance)

		return () => {
			persistentLifecycle.capture(instance)
			unregisterTreemapFocus()
			chartRef.current = null
			emitReady(null)
			instance.dispose()
		}
	}, [persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option: TreemapOption = {
			...(canvasWatermarkEnabled ? { graphic: [buildWatermarkGraphic(isDark)] } : {}),
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: (rawInfo: unknown) => {
					if (!isTreemapFormatterParams(rawInfo)) return ''
					const info = rawInfo
					if (variant === 'narrative') {
						return formatNarrativeTreemapTooltip(Array.isArray(info.treePathInfo) ? info.treePathInfo : [], info.value)
					}
					if (isFlatVariant) {
						return `<strong>${escapeHtml(String(info.name ?? ''))}</strong><br>${escapeHtml(valueLabel)}: ${formatTreemapMetricValue(info.value[0])}`
					}

					return formatRwaTreemapTooltip({
						info,
						valueLabel,
						formatMetricValue: formatTreemapMetricValue
					})
				}
			},
			...(isNarrativeVariant ? { toolbox: { feature: { restore: {} } } } : {}),
			series: [
				{
					name: isRwaVariant ? rwaRootLabel : 'All',
					type: 'treemap',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					roam: isRwaVariant,
					nodeClick: isRwaVariant ? 'zoomToNode' : false,
					breadcrumb: { show: false },
					...(isRwaVariant
						? {
								// Keep RWA node color stable on hover; tooltip still works.
								emphasis: { disabled: true }
							}
						: {}),
					label: {
						position: isFlatVariant ? 'insideTopLeft' : 'insideTopRight',
						formatter: (rawParams: unknown) => {
							if (!isTreemapFormatterParams(rawParams)) return ''
							const params = rawParams
							if (isFlatVariant) {
								return `{flatName|${String(params.name ?? '')}}\n{flatValue|${formatTreemapMetricValue(params.value[0])}}`
							}
							const data = params.data
							if (!isTreemapNode(data)) return ''
							const path = data.path ?? ''
							const pathParts = path ? path.split('/') : []
							if (pathParts.length > 1) {
								const hasChildren = (data.children?.length ?? 0) > 0
								if (isRwaVariant && hasChildren) {
									// Parent nodes: show the group name directly for visibility.
									return String(params.name ?? '')
								}
								const value = params.value

								if (variant === 'narrative') return formatNarrativeTreemapLabel(pathParts[pathParts.length - 1]!, value)
								if (isRwaVariant) {
									return [
										`{rwaName|${String(params.name ?? '')}}`,
										`{rwaMetric|${valueLabel}: ${formatTreemapMetricValue(value[0])}}`
									].join('\n')
								}
							}
							return String(params.name ?? '')
						},
						rich: {
							name: {
								fontSize: 15,
								lineHeight: 20
							},
							apy: {
								fontSize: 13,
								lineHeight: 20
							},
							rwaName: {
								fontSize: 12,
								lineHeight: 18
							},
							rwaMetric: {
								fontSize: 12,
								lineHeight: 18
							},
							flatName: {
								fontSize: 13,
								fontWeight: 600,
								lineHeight: 20
							},
							flatValue: {
								fontSize: 11,
								lineHeight: 18
							}
						}
					},
					upperLabel: {
						show: true,
						height: 20,
						...(isRwaVariant ? { formatter: '{b}' } : {})
					},
					itemStyle: {
						borderColor: isRwaVariant ? (isDark ? '#2d3139' : '#d1d5db') : '#fff'
					},
					levels: isFlatVariant
						? [
								{
									...(isCategoricalColor ? { color: CHART_COLORS, colorMappingBy: 'index' } : {}),
									itemStyle: { borderWidth: 0, gapWidth: 1 },
									upperLabel: { show: false }
								},
								{
									itemStyle: { borderColor: chartTheme.exportBg, borderWidth: 2, gapWidth: 1 },
									emphasis: { itemStyle: { borderColor: chartTheme.ink(0.2) } }
								}
							]
						: [
								{
									itemStyle: {
										borderColor: isRwaVariant ? (isDark ? '#2d3139' : '#d1d5db') : '#777',
										borderWidth: 0,
										gapWidth: 1,
										...(isRwaVariant ? { color: isDark ? '#374151' : '#e5e7eb' } : {})
									},
									upperLabel:
										isRwaVariant && showRootLabel
											? {
													show: true,
													height: 22,
													padding: [0, 4],
													formatter: '{b}'
												}
											: {
													show: false
												}
								},
								{
									...(isCategoricalColor && !isRwaVariant ? { color: CHART_COLORS, colorMappingBy: 'index' } : {}),
									itemStyle: isRwaVariant
										? {
												borderColor: isDark ? '#2d3139' : '#d1d5db',
												borderWidth: 2,
												gapWidth: 1
											}
										: {
												borderColor: '#555',
												borderWidth: 5,
												gapWidth: 1
											},
									...(isRwaVariant
										? {
												upperLabel: {
													show: true,
													height: 22,
													padding: [0, 2],
													formatter: '{b}',
													...(isDark
														? {
																backgroundColor: 'rgba(55,65,81,0.88)'
															}
														: { backgroundColor: 'rgba(229,231,235,0.92)' })
												}
											}
										: {}),
									emphasis: {
										itemStyle: {
											borderColor: isRwaVariant ? (isDark ? '#2d3139' : '#d1d5db') : '#ddd'
										}
									}
								},
								{
									...(isCategoricalColor && !isRwaVariant ? { colorSaturation: [0.55, 0.9] } : {}),
									itemStyle: isRwaVariant
										? {
												borderWidth: 1,
												gapWidth: 0,
												borderColor: isDark ? '#2d3139' : '#d1d5db'
											}
										: {
												borderWidth: 5,
												gapWidth: 1,
												borderColorSaturation: 0.6
											}
								}
							],
					data: treeData
				}
			]
		}
		clearTreemapFocus(instance)
		instance.setOption(option, { notMerge: true })
	}, [
		canvasWatermarkEnabled,
		chartTheme,
		formatTreemapMetricValue,
		isCategoricalColor,
		isDark,
		isFlatVariant,
		isNarrativeVariant,
		isRwaVariant,
		rwaRootLabel,
		showRootLabel,
		valueLabel,
		treeData,
		variant
	])

	const resolvedHeight = height ?? (variant === 'narrative' ? '533px' : '800px')
	// Treemap zoom can paint outside the series rectangle, but never outside
	// its canvas. Inset the canvas itself so zoomed nodes preserve the edge gap.
	const chart = (
		<div
			className={
				containerClassName ? `flex w-full flex-col overflow-hidden ${containerClassName}` : 'w-full overflow-hidden'
			}
			style={{ height: containerClassName ? undefined : resolvedHeight, padding: CHART_INSET, boxSizing: 'border-box' }}
		>
			<div ref={containerRef} className={containerClassName ? 'flex-1' : 'h-full w-full'} />
		</div>
	)

	return chart
}

export default withEChartsRenderVisibility(TreemapChart)

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
	const gradient = value[3]
	return (
		(secondary === null || typeof secondary === 'number') &&
		(color === null || typeof color === 'number') &&
		(gradient === undefined || typeof gradient === 'number')
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

const VISUAL_MIN = -100
const VISUAL_MAX = 100

echarts.use([TreemapLabelContrast, TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer, GraphicComponent])

function TreemapChart({
	treeData,
	variant,
	colorMode = 'value',
	height,
	onReady,
	showRootLabel = true,
	valueLabel = 'Market Cap',
	valueSymbol = '$'
}: TreemapChartProps) {
	const isNarrativeVariant = variant === 'narrative'
	const isRwaVariant = variant === 'rwa'
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
					...(isRwaVariant || isCategoricalColor
						? {}
						: {
								visualMin: VISUAL_MIN,
								visualMax: VISUAL_MAX,
								visualDimension: 3
							}),
					...(isNarrativeVariant
						? {
								roam: false,
								nodeClick: false,
								breadcrumb: { show: false }
							}
						: isRwaVariant
							? {
									roam: true,
									nodeClick: 'zoomToNode',
									breadcrumb: { show: false }
								}
							: {
									breadcrumb: {
										itemStyle: {
											color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)',
											textStyle: {
												fontFamily: 'sans-serif',
												fontWeight: 400,
												color: chartTheme.text
											}
										}
									}
								}),
					...(isRwaVariant
						? {
								// Keep RWA node color stable on hover; tooltip still works.
								emphasis: { disabled: true }
							}
						: {}),
					label: {
						position: 'insideTopRight',
						formatter: (rawParams: unknown) => {
							if (!isTreemapFormatterParams(rawParams)) return ''
							const params = rawParams
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
					levels: [
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
							...(isRwaVariant
								? {}
								: isCategoricalColor
									? {
											color: CHART_COLORS,
											colorMappingBy: 'index'
										}
									: {
											color: ['#942e38', '#aaa', '#269f3c'],
											colorMappingBy: 'value'
										}),
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
							...(isRwaVariant ? {} : { colorSaturation: isCategoricalColor ? [0.55, 0.9] : [0, 1] }),
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
			className="w-full overflow-hidden"
			style={{ height: resolvedHeight, padding: CHART_INSET, boxSizing: 'border-box' }}
		>
			<div ref={containerRef} className="h-full w-full" />
		</div>
	)

	return chart
}

export default withEChartsRenderVisibility(TreemapChart)

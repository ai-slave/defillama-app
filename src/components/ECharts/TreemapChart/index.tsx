import type { EChartsOption } from 'echarts'
import { TreemapChart as EChartTreemap } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { CHART_COLORS } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { CHART_INSET } from '../shared/chartSpacing'
import { getChartTheme } from '../shared/chartTheme'
import { formatChartValue } from '../shared/formatters'
import { buildWatermarkGraphic } from '../shared/watermark'
import { clearTreemapFocus, registerTreemapFocusTracking } from './focus'
import { formatRwaTreemapBoxLabel, formatRwaTreemapTooltip, formatRwaUpperLabel } from './rwaFormatting'
import type { TreemapChartProps, TreemapNode, TreemapValue } from './types'

const VISUAL_MIN = -100
const VISUAL_MAX = 100

echarts.use([TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer, GraphicComponent])

function TreemapChart({
	treeData,
	variant,
	colorMode = 'value',
	height,
	onReady,
	valueLabel = 'Market Cap',
	valueSymbol = '$'
}: TreemapChartProps) {
	const isNarrativeVariant = variant === 'narrative'
	const isRwaVariant = variant === 'rwa'
	const isCategoricalColor = colorMode === 'categorical'

	const [isDark] = useDarkModeManager()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const onReadyRef = useRef(onReady)
	useEffect(() => {
		onReadyRef.current = onReady
	})

	// Stable resize listener - never re-attaches when dependencies change
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
		onReadyRef.current?.(instance)

		const unregisterTreemapFocus = registerTreemapFocusTracking(instance)

		return () => {
			persistentLifecycle.capture(instance)
			unregisterTreemapFocus()
			chartRef.current = null
			onReadyRef.current?.(null)
			instance.dispose()
		}
	}, [persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option: EChartsOption = {
			graphic: [buildWatermarkGraphic(isDark)],
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: function (info) {
					const treePathInfo = Array.isArray(info?.treePathInfo) ? info.treePathInfo : []
					const treePath: string[] = []
					for (let i = 1; i < treePathInfo.length; i++) {
						treePath.push(treePathInfo[i].name)
					}

					if (variant === 'narrative') {
						if (treePath.length > 1) {
							return [
								`${treePath[1]}<br>`,
								`Return: ${formatPercent(info.value[1], { input: 'percent' })}<br>`,
								`Market Cap: ${formatUsd(info.value[0], { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}<br>`
							].join('')
						} else {
							return null
						}
					}

					if (isRwaVariant) {
						return formatRwaTreemapTooltip({
							info,
							valueLabel,
							formatMetricValue: formatTreemapMetricValue
						})
					}
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
											color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)'
										},
										textStyle: {
											fontFamily: 'sans-serif',
											fontWeight: 400,
											color: chartTheme.text
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
						...(isRwaVariant
							? {
									color: '#fff',
									textBorderColor: 'rgba(0,0,0,0.35)',
									textBorderWidth: 2
								}
							: {}),
						formatter: function (params) {
							let arr
							const data = params.data as TreemapNode
							const path = data.path ?? ''
							const pathParts = path ? path.split('/') : []
							if (pathParts.length > 1) {
								const hasChildren = (data.children?.length ?? 0) > 0
								if (isRwaVariant && hasChildren) {
									// Parent nodes: show the group name directly for visibility.
									return String(params.name ?? '')
								}
								const value = params.value as TreemapValue

								if (variant === 'narrative') {
									arr = [
										`{name|${pathParts[pathParts.length - 1]}}`,
										`Return: {apy| ${formatPercent(value[1] ?? 0, { input: 'percent' })}}`,
										`Market Cap: {mcap| ${formatUsd(value[0], { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}}`
									]
								} else if (isRwaVariant) {
									arr = [
										`{rwaName|${formatRwaTreemapBoxLabel(params)}}`,
										`{rwaMetric|${valueLabel}: ${formatTreemapMetricValue(value[0])}}`
									]
								}
							} else {
								arr = [String(params.name ?? '')]
							}
							return arr.join('\n')
						},
						rich: {
							name: {
								fontSize: 15,
								color: '#fff',
								lineHeight: 20
							},
							apy: {
								fontSize: 13,
								color: '#fff',
								lineHeight: 20
							},
							rwaName: {
								fontSize: 12,
								color: '#fff',
								lineHeight: 18
							},
							rwaMetric: {
								fontSize: 12,
								color: '#fff',
								lineHeight: 18
							}
						}
					},
					upperLabel: {
						show: true,
						height: 20,
						color: chartTheme.treemapLabel,
						...(isRwaVariant ? { formatter: formatRwaUpperLabel } : {})
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
							upperLabel: isRwaVariant
								? {
										show: true,
										height: 22,
										padding: [0, 4],
										color: isDark ? '#fff' : '#1f2937',
										formatter: formatRwaUpperLabel,
										...(isDark ? { textBorderColor: 'rgba(0,0,0,0.3)', textBorderWidth: 2 } : {})
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
											color: isDark ? '#fff' : '#1f2937',
											formatter: formatRwaUpperLabel,
											...(isDark
												? {
														backgroundColor: 'rgba(55,65,81,0.88)',
														textBorderColor: 'rgba(0,0,0,0.3)',
														textBorderWidth: 2
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
		chartTheme,
		formatTreemapMetricValue,
		isCategoricalColor,
		isDark,
		isNarrativeVariant,
		isRwaVariant,
		rwaRootLabel,
		valueLabel,
		treeData,
		valueSymbol,
		variant
	])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		// Container height changes don't automatically trigger echarts resize.
		const raf = requestAnimationFrame(() => {
			if (instance.isDisposed()) return
			instance.resize()
		})
		return () => cancelAnimationFrame(raf)
	}, [height])

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

import type { EChartsOption } from 'echarts'
import { TreemapChart as EChartTreemap } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useCanvasWatermarkEnabled } from '~/components/ECharts/shared/watermark'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { formatPercent } from '~/utils/numberFormat'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../../renderVisibility'
import { clearTreemapFocus, registerTreemapFocusTracking } from '../focus'
import { formatTreemapUsd } from '../formatters'

echarts.use([TooltipComponent, GraphicComponent, ToolboxComponent, EChartTreemap, CanvasRenderer])

interface BuilderTreemapChartProps {
	data: Array<{
		name: string
		value: number
		itemStyle?: { color: string }
	}>
	height?: string
	onReady?: (instance: echarts.ECharts | null) => void
}

// Treemap does not clip to the series box when zoomed; outer padding + overflow:hidden preserves the inset.
const CHART_INSET_PX = 8

interface TreemapFormatterParams {
	name?: string
	value?: unknown
}

function normalizeTreemapFormatterParams(params: unknown): TreemapFormatterParams {
	return params && typeof params === 'object' ? (params as TreemapFormatterParams) : {}
}

function BuilderTreemapChart({ data, height = '450px', onReady }: BuilderTreemapChartProps) {
	const canvasWatermarkEnabled = useCanvasWatermarkEnabled()
	const [isDark] = useDarkModeManager()
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const onReadyRef = useRef(onReady)
	useEffect(() => {
		onReadyRef.current = onReady
	})

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const instance = echarts.init(container, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		onReadyRef.current?.(instance)
		const unregisterTreemapFocus = registerTreemapFocusTracking(instance)

		return () => {
			persistentLifecycle.capture(instance)
			unregisterTreemapFocus()
			instance.dispose()
			chartRef.current = null
			onReadyRef.current?.(null)
		}
	}, [persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		if (data.length === 0) {
			instance.clear()
			clearTreemapFocus(instance)
			return
		}

		const total = data.reduce((sum, item) => sum + item.value, 0)

		const graphic = canvasWatermarkEnabled
			? {
					type: 'image',
					z: 100,
					style: {
						image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
						height: 40,
						opacity: 0.3
					},
					left: isSmall ? '40%' : '45%',
					top: '45%'
				}
			: undefined

		const option: EChartsOption = {
			graphic,
			toolbox: {
				show: false,
				feature: {
					restore: {
						title: 'Reset'
					}
				}
			},
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter(rawInfo: unknown) {
					const info = normalizeTreemapFormatterParams(rawInfo)
					const rawValue = typeof info.value === 'number' ? info.value : Number(info.value ?? 0)
					const pct = formatPercent(total > 0 ? rawValue / total : 0, {
						input: 'fraction',
						minimumFractionDigits: 1,
						maximumFractionDigits: 1
					})
					return `<div style="font-weight:600">${info.name ?? ''}</div><div>${formatTreemapUsd(rawValue)} (${pct})</div>`
				}
			},
			series: [
				{
					type: 'treemap',
					data,
					sort: 'desc',
					squareRatio: 1,
					left: 0,
					right: 0,
					top: 0,
					bottom: 0,
					roam: true,
					nodeClick: 'zoomToNode',
					breadcrumb: { show: false },
					label: {
						show: true,
						position: 'insideTopLeft',
						padding: [4, 6],
						formatter(rawParams: unknown) {
							const params = normalizeTreemapFormatterParams(rawParams)
							const rawValue = typeof params.value === 'number' ? params.value : Number(params.value ?? 0)
							const pct = formatPercent(total > 0 ? rawValue / total : 0, {
								input: 'fraction',
								minimumFractionDigits: 1,
								maximumFractionDigits: 1
							})
							return `{name|${params.name ?? ''}}\n{value|${formatTreemapUsd(rawValue)} (${pct})}`
						},
						rich: {
							name: {
								fontSize: 14,
								fontWeight: 600,
								color: '#fff',
								lineHeight: 20
							},
							value: {
								fontSize: 12,
								color: 'rgba(255,255,255,0.8)',
								lineHeight: 18
							}
						}
					},
					upperLabel: {
						show: false
					},
					itemStyle: {
						borderColor: isDark ? '#1a1a1a' : '#fff',
						borderWidth: 2,
						gapWidth: 2,
						opacity: 0.9
					},
					levels: [
						{
							itemStyle: {
								borderColor: isDark ? '#333' : '#ddd',
								borderWidth: 0,
								gapWidth: 2
							}
						}
					]
				}
			]
		}

		clearTreemapFocus(instance)
		instance.setOption(option, true)
	}, [canvasWatermarkEnabled, data, isDark, isSmall])

	return (
		<div
			className="relative w-full overflow-hidden"
			style={{
				height,

				padding: CHART_INSET_PX
			}}
		>
			<div ref={containerRef} className="h-full w-full" />
			{data.length === 0 ? (
				<div className="absolute inset-0 flex items-center justify-center">
					<p className="body-sm text-tertiary">No data available for treemap</p>
				</div>
			) : null}
		</div>
	)
}

export default withEChartsRenderVisibility(BuilderTreemapChart)

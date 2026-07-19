import { TreemapChart as EChartTreemap } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { clearTreemapFocus, registerTreemapFocusTracking } from '../treemapFocus'

echarts.use([TooltipComponent, GraphicComponent, ToolboxComponent, EChartTreemap, CanvasRenderer])

interface TreeMapBuilderChartProps {
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

const formatValue = (value: number) => {
	const absValue = Math.abs(value)
	if (absValue >= 1e9) {
		return '$' + (value / 1e9).toFixed(1) + 'B'
	} else if (absValue >= 1e6) {
		return '$' + (value / 1e6).toFixed(1) + 'M'
	} else if (absValue >= 1e3) {
		return '$' + (value / 1e3).toFixed(0) + 'K'
	}
	return '$' + value.toFixed(0)
}

export default function TreeMapBuilderChart({ data, height = '450px', onReady }: TreeMapBuilderChartProps) {
	const [isDark] = useDarkModeManager()
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
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
		onReadyRef.current?.(instance)
		const unregisterTreemapFocus = registerTreemapFocusTracking(instance)

		return () => {
			unregisterTreemapFocus()
			instance.dispose()
			chartRef.current = null
			onReadyRef.current?.(null)
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		if (data.length === 0) {
			instance.clear()
			clearTreemapFocus(instance)
			return
		}

		const total = data.reduce((sum, item) => sum + item.value, 0)

		const graphic = {
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

		const option = {
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
				formatter: function (info: any) {
					const rawValue = info.value as number
					const pct = total > 0 ? ((rawValue / total) * 100).toFixed(1) : '0'
					return `<div style="font-weight:600">${info.name}</div><div>${formatValue(rawValue)} (${pct}%)</div>`
				}
			},
			series: [
				{
					type: 'treemap',
					data: data,
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
						formatter: function (params: any) {
							const rawValue = params.value as number
							const pct = total > 0 ? ((rawValue / total) * 100).toFixed(1) : '0'
							return `{name|${params.name}}\n{value|${formatValue(rawValue)} (${pct}%)}`
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
	}, [data, isDark, isSmall])

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

import { TreemapChart as EChartTreemap } from 'echarts/charts'
import { GraphicComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useMemo, useRef } from 'react'
import { CHART_INSET } from '~/components/ECharts/chartSpacing'
import { buildWatermarkGraphic } from '~/components/ECharts/utils'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formattedNum } from '~/utils'
import { formatSignedRWAFlow } from './flows'
import type { RWAFlowTreemapNode } from './flowTreemap'

echarts.use([TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer, GraphicComponent, LabelLayout])

const NEGATIVE_COLOR = '#942e38'
const NEUTRAL_COLOR = '#8b929a'
const POSITIVE_COLOR = '#269f3c'
const MIN_COLOR_CAP_PERCENT = 0.01
const COLOR_INTENSITY_EXPONENT = 0.7

function hexToRgb(hex: string): [number, number, number] {
	return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function lerpHex(from: string, to: string, ratio: number): string {
	const a = hexToRgb(from)
	const b = hexToRgb(to)
	return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * ratio)).join(',')})`
}

function getColorCap(nodes: readonly RWAFlowTreemapNode[]): number {
	const values: number[] = []
	for (const node of nodes) {
		const value = Math.abs(node.value[1] ?? 0)
		if (value > 0) values.push(value)
	}
	if (values.length === 0) return MIN_COLOR_CAP_PERCENT
	values.sort((a, b) => a - b)
	return Math.max(values[Math.ceil(values.length * 0.9) - 1], MIN_COLOR_CAP_PERCENT)
}

function getFlowColor(value: number | null, colorCap: number): string {
	if (value == null || value === 0) return NEUTRAL_COLOR
	// Lift meaningful mid-range moves while keeping tiny changes close to neutral.
	const ratio = Math.min(Math.abs(value) / colorCap, 1) ** COLOR_INTENSITY_EXPONENT
	return value > 0 ? lerpHex(NEUTRAL_COLOR, POSITIVE_COLOR, ratio) : lerpHex(NEUTRAL_COLOR, NEGATIVE_COLOR, ratio)
}

function formatFlowPercent(value: number | null): string {
	if (value == null) return '-'
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function pickLabel(width: number, height: number, name: string, flow: string, percentage: string): string {
	if (width >= 88 && height >= 62) return `{name|${name}}\n{flow|${flow}}\n{percent|${percentage}}`
	if (width >= 64 && height >= 42) return `{nameSmall|${name}}\n{percentSmall|${percentage}}`
	if (width >= 38 && height >= 22) return `{nameTiny|${name}}`
	return ''
}

export function RWAFlowTreemapChart({
	nodes,
	sizeLabel,
	periodLabel,
	height = '600px',
	onReady
}: {
	nodes: RWAFlowTreemapNode[]
	sizeLabel: string
	periodLabel: string
	height?: string
	onReady?: (instance: echarts.ECharts | null) => void
}) {
	const [isDark] = useDarkModeManager()
	const chartElementRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const onReadyRef = useRef(onReady)
	useEffect(() => {
		onReadyRef.current = onReady
	})
	useChartResize(chartRef)

	const chartData = useMemo(() => {
		const colorCap = getColorCap(nodes)
		const data: Array<RWAFlowTreemapNode & { itemStyle: { color: string } }> = []
		for (const node of nodes) {
			data.push({ ...node, itemStyle: { color: getFlowColor(node.value[1], colorCap) } })
		}
		return data
	}, [nodes])

	useEffect(() => {
		const element = chartElementRef.current
		if (!element) return
		const instance = echarts.getInstanceByDom(element) || echarts.init(element, null, { renderer: 'canvas' })
		chartRef.current = instance
		onReadyRef.current?.(instance)
		const resizeObserver = new ResizeObserver(() => {
			if (!instance.isDisposed()) instance.resize()
		})
		resizeObserver.observe(element)

		const handleClick = (params: any) => {
			if (params?.seriesType !== 'treemap') return
			const node = (instance as any)
				.getModel?.()
				?.getSeriesByIndex?.(params.seriesIndex ?? 0)
				?.getData?.()
				?.tree?.getNodeByDataIndex?.(params.dataIndex)
			const nodeId = node?.getId?.()
			if (typeof nodeId === 'string' && nodeId) (instance as any).__llamaTreemapFocusNode = { id: nodeId }
		}
		const handleRestore = () => delete (instance as any).__llamaTreemapFocusNode
		instance.on('click', handleClick)
		instance.on('restore', handleRestore)

		return () => {
			resizeObserver.disconnect()
			instance.off('click', handleClick)
			instance.off('restore', handleRestore)
			chartRef.current = null
			onReadyRef.current?.(null)
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option = {
			graphic: [buildWatermarkGraphic(isDark)],
			toolbox: { show: false, feature: { restore: {} } },
			tooltip: {
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: (info) => {
					const data = info?.data as RWAFlowTreemapNode | undefined
					if (!data) return ''
					return [
						`<strong>${data.name}</strong><br>`,
						`${sizeLabel}: ${formattedNum(data.value[0], true)}<br>`,
						`${periodLabel} Net Flow: ${formatSignedRWAFlow(data.netFlowUsd)}<br>`,
						`Net Flow / ${sizeLabel}: ${formatFlowPercent(data.value[1])}`
					].join('')
				}
			},
			series: [
				{
					name: 'RWA Net Flow',
					type: 'treemap',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					roam: true,
					nodeClick: 'zoomToNode',
					zoomToNodeRatio: 0.35,
					squareRatio: 0.9,
					breadcrumb: { show: false },
					label: {
						position: 'inside',
						formatter: (params) => {
							const data = params?.data as RWAFlowTreemapNode | undefined
							if (!data) return ''
							const layout = (instance as any)
								.getModel?.()
								?.getSeriesByIndex?.(params.seriesIndex ?? 0)
								?.getData?.()
								?.getItemLayout?.(params.dataIndex)
							return pickLabel(
								layout?.width ?? 0,
								layout?.height ?? 0,
								data.name,
								formatSignedRWAFlow(data.netFlowUsd),
								formatFlowPercent(data.value[1])
							)
						},
						rich: {
							name: { color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 20 },
							flow: { color: '#fff', fontSize: 13, lineHeight: 18 },
							percent: { color: '#fff', fontSize: 13, lineHeight: 18 },
							nameSmall: { color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 17 },
							percentSmall: { color: '#fff', fontSize: 11, lineHeight: 15 },
							nameTiny: { color: '#fff', fontSize: 10, fontWeight: 600 }
						}
					},
					labelLayout: (params) => {
						if (!params?.rect || typeof params.text !== 'string' || !params.text) return {}
						const lineCount = params.text.split('\n').length
						const contentHeight = lineCount === 3 ? 56 : lineCount === 2 ? 32 : 14
						return { dy: (params.rect.height - contentHeight) / 2 }
					},
					itemStyle: { borderColor: isDark ? '#2d3139' : '#d1d5db', borderWidth: 1, gapWidth: 1 },
					levels: [
						{ itemStyle: { borderWidth: 0, gapWidth: 1 }, upperLabel: { show: false } },
						{
							itemStyle: { borderColor: isDark ? '#2d3139' : '#d1d5db', borderWidth: 1, gapWidth: 1 },
							upperLabel: { show: false }
						}
					],
					data: chartData
				}
			]
		}

		instance.setOption(option, { notMerge: true, lazyUpdate: true })
	}, [chartData, isDark, periodLabel, sizeLabel])

	return (
		<div
			className="flex w-full flex-col gap-2 overflow-hidden"
			style={{ height, padding: CHART_INSET, boxSizing: 'border-box' }}
		>
			<div ref={chartElementRef} className="min-h-0 w-full flex-1 overflow-hidden" />
			<div
				className="flex shrink-0 justify-end px-1 text-xs text-tertiary"
				role="img"
				aria-label="Treemap color scale: outflow through zero to inflow"
			>
				<div className="w-40">
					<div
						className="h-1.5 rounded-full border border-subtle"
						style={{ background: `linear-gradient(to right, ${NEGATIVE_COLOR}, ${NEUTRAL_COLOR}, ${POSITIVE_COLOR})` }}
					/>
					<div className="flex justify-between pt-0.5">
						<span>Outflow</span>
						<span>0</span>
						<span>Inflow</span>
					</div>
				</div>
			</div>
		</div>
	)
}

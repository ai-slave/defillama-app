import type { EChartsOption, GraphicComponentOption, TooltipComponentOption } from 'echarts'
import { SankeyChart as ESankeyChart, type SankeySeriesOption } from 'echarts/charts'
import { GraphicComponent, GridComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { useCanvasWatermarkEnabled } from '~/components/ECharts/shared/watermark'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useMedia } from '~/hooks/useMedia'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { ChartContainer } from '../shared/ChartContainer'
import { ChartHeader } from '../shared/ChartHeader'
import { useChartTheme } from '../shared/chartTheme'
import { formatChartValue } from '../shared/formatters'
import {
	buildSankeyNodeMetadata,
	createMobileLabelLayout,
	formatSankeyNodeLabel,
	formatSankeyNodeValue
} from './labels'
import type { ISankeyChartProps } from './types'

echarts.use([
	CanvasRenderer,
	ESankeyChart,
	TooltipComponent,
	TitleComponent,
	GridComponent,
	GraphicComponent,
	LabelLayout
])

const MOBILE_LABEL_WIDTH = 132

interface SankeyFormatterParams {
	data?: { source?: string; target?: string; value?: number }
	dataType?: string
	name: string
	value: number
}

function normalizeSankeyFormatterParams(params: unknown): SankeyFormatterParams {
	if (!isSankeyFormatterParams(params)) return { name: '', value: 0 }
	return {
		...params,
		name: params.name ?? '',
		value: typeof params.value === 'number' ? params.value : Number(params.value ?? 0)
	}
}

function isSankeyFormatterParams(params: unknown): params is Partial<SankeyFormatterParams> {
	return params !== null && typeof params === 'object'
}

function SankeyChart({
	height = '500px',
	nodes,
	links,
	title,
	headingAs,
	valueSymbol = '$',
	nodeColors,
	nodeAlign = 'justify',
	orient = 'horizontal',
	onReady,
	enableImageExport = false,
	imageExportFilename,
	imageExportTitle,
	...props
}: ISankeyChartProps) {
	const canvasWatermarkEnabled = useCanvasWatermarkEnabled()
	const [isDark] = useDarkModeManager()
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const useMobileLayout = isSmall && orient === 'horizontal'
	const chartTheme = useChartTheme(isDark)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const exportFilename = imageExportFilename || (title ? title.replace(/\s+/g, '-').toLowerCase() : 'sankey-chart')
	const exportTitle = imageExportTitle || title
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const isVisibleRef = useRef(false)
	const onReadyRef = useRef(onReady)
	const formatSankeyValue = useCallback((value: number): string => formatChartValue(value, valueSymbol), [valueSymbol])

	useEffect(() => {
		onReadyRef.current = onReady
	})

	const nodeMetadata = useMemo(() => buildSankeyNodeMetadata(nodes), [nodes])

	const series = useMemo<SankeySeriesOption>(() => {
		const depthRanks = new Map<number, number>()
		const maxDepth = Math.max(0, ...nodes.map((node) => node.depth ?? 0))
		const nodeData = nodes.map((node) => {
			const color = nodeColors?.[node.name] ?? node.color ?? undefined
			const depth = node.depth ?? 0
			const depthRank = depthRanks.get(depth) ?? 0
			depthRanks.set(depth, depthRank + 1)
			const mobileLabelPosition: 'left' | 'right' =
				depth >= 2 && depth < maxDepth && depthRank % 2 === 1 ? 'left' : 'right'
			const dataItem = {
				name: node.name,
				...(useMobileLayout ? { label: { position: mobileLabelPosition } } : {}),
				...(node.depth !== undefined ? { depth: node.depth } : {})
			}
			return color === undefined ? dataItem : { ...dataItem, itemStyle: { color } }
		})
		return {
			type: 'sankey',
			layout: 'none',
			nodeAlign,
			orient,
			emphasis: {
				focus: 'adjacency'
			},
			nodeGap: useMobileLayout ? 32 : 24,
			nodeWidth: 16,
			lineStyle: {
				color: 'gradient',
				curveness: 0.5,
				opacity: 0.4
			},
			label: {
				show: true,
				position: orient === 'horizontal' ? 'right' : 'bottom',
				fontFamily: 'sans-serif',
				fontSize: 14,
				color: chartTheme.ink(0.9),
				...(useMobileLayout
					? {
							lineHeight: 16,
							width: MOBILE_LABEL_WIDTH,
							overflow: 'break' as const
						}
					: {}),
				formatter: (rawParams: unknown) => {
					const params = normalizeSankeyFormatterParams(rawParams)
					return formatSankeyNodeLabel(params.name, params.value, nodeMetadata, formatSankeyValue, !isSmall)
				},
				rich: {
					name: {
						fontSize: 14,
						fontWeight: 'normal',
						color: chartTheme.ink(0.9)
					},
					desc: {
						fontSize: 10,
						color: chartTheme.ink(0.5)
					}
				}
			},
			data: nodeData,
			links: links.map((link) => {
				const dataItem = { source: link.source, target: link.target, value: link.value }
				return link.color ? { ...dataItem, lineStyle: { color: link.color } } : dataItem
			})
		}
	}, [
		nodes,
		links,
		nodeColors,
		nodeAlign,
		orient,
		chartTheme,
		useMobileLayout,
		isSmall,
		formatSankeyValue,
		nodeMetadata
	])

	const option = useMemo<EChartsOption>(() => {
		const graphic: GraphicComponentOption = canvasWatermarkEnabled
			? {
					type: 'image',
					z: 0,
					style: {
						image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
						height: 40,
						opacity: 0.3
					},
					left: isSmall ? '35%' : '40%',
					top: '50%'
				}
			: undefined
		const tooltip: TooltipComponentOption = {
			trigger: 'item',
			triggerOn: isSmall ? 'click' : 'mousemove',
			confine: true,
			className: 'defillama-echarts-tooltip',
			backgroundColor: 'transparent',
			borderWidth: 0,
			formatter: (rawParams: unknown) => {
				const params = normalizeSankeyFormatterParams(rawParams)
				if (params.dataType === 'edge' && params.data) {
					return `${escapeHtml(params.data.source ?? '')} → ${escapeHtml(params.data.target ?? '')}<br/>${formatSankeyValue(params.data.value ?? 0)}`
				}
				const valueWithPercent = formatSankeyNodeValue(params.name, params.value, nodeMetadata, formatSankeyValue)
				const description = nodeMetadata.descriptions[params.name]
				if (description) {
					return `<strong>${escapeHtml(params.name)}</strong><br/>${valueWithPercent}<br/><span style="color: var(--text-secondary); font-size: 11px;">${escapeHtml(description)}</span>`
				}
				return `${escapeHtml(params.name)}<br/>${valueWithPercent}`
			}
		}
		if (useMobileLayout) {
			tooltip.extraCssText = 'max-width: calc(100% - 8px); white-space: normal; overflow-wrap: anywhere;'
		}

		return {
			graphic,
			tooltip,
			series
		}
	}, [canvasWatermarkEnabled, series, isDark, isSmall, useMobileLayout, nodeMetadata, formatSankeyValue])

	const getOption = useCallback(
		(element: HTMLDivElement): EChartsOption => {
			if (!useMobileLayout) return option
			return {
				...option,
				series: {
					...series,
					labelLayout: createMobileLabelLayout(nodes, () => ({
						width: element.clientWidth || 320,
						height: element.clientHeight || 450
					}))
				}
			}
		},
		[nodes, option, series, useMobileLayout]
	)

	const applyOption = useCallback(() => {
		const instance = chartRef.current
		const element = containerRef.current
		if (!isVisibleRef.current || !instance || instance.isDisposed() || !element) return
		instance.setOption(getOption(element), { notMerge: true })
	}, [getOption])

	const initializeChart = useCallback(() => {
		const currentInstance = chartRef.current
		if (currentInstance && !currentInstance.isDisposed()) {
			applyOption()
			return
		}

		const element = containerRef.current
		if (!element?.isConnected) {
			isVisibleRef.current = false
			return
		}
		const bounds = element.getBoundingClientRect()
		if (bounds.width <= 0 || bounds.height <= 0) {
			isVisibleRef.current = false
			return
		}

		const instance = echarts.init(element, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		isVisibleRef.current = true
		handleChartReady(instance)
		onReadyRef.current?.(instance)
		applyOption()
	}, [applyOption, handleChartReady, persistentLifecycle])

	const handleElementResize = useCallback(
		(isVisible: boolean) => {
			if (!isVisible) {
				isVisibleRef.current = false
				return
			}
			if (isVisibleRef.current) return
			isVisibleRef.current = true
			initializeChart()
		},
		[initializeChart]
	)

	useChartResize(chartRef, containerRef, { onVisibilityChange: handleElementResize })

	useEffect(() => {
		const instance = chartRef.current
		if (!instance || instance.isDisposed()) {
			initializeChart()
			return
		}
		applyOption()
	}, [applyOption, initializeChart])

	useEffect(() => {
		return () => {
			const instance = chartRef.current
			if (instance) persistentLifecycle.capture(instance)
			chartRef.current = null
			isVisibleRef.current = false
			handleChartReady(null)
			onReadyRef.current?.(null)
			if (instance && !instance.isDisposed()) instance.dispose()
		}
	}, [handleChartReady, persistentLifecycle])

	return (
		<ChartContainer
			chartRef={containerRef}
			chartClassName=""
			chartStyle={{ height, minHeight: useMobileLayout ? `${Math.max(450, nodes.length * 64)}px` : undefined }}
			header={
				title || enableImageExport ? (
					<ChartHeader
						title={title}
						headingAs={headingAs}
						className="mb-2 flex items-center justify-end gap-2"
						exportButtons={
							enableImageExport ? (
								<ChartPngExportButton
									chartInstance={exportChartInstance}
									filename={exportFilename}
									title={exportTitle}
								/>
							) : null
						}
					/>
				) : null
			}
			{...props}
		/>
	)
}

export default withEChartsRenderVisibility(SankeyChart)

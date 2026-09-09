import type {
	EChartsOption,
	GraphicComponentOption,
	LabelLayoutOptionCallbackParams,
	TooltipComponentOption
} from 'echarts'
import { SankeyChart as ESankeyChart, type SankeySeriesOption } from 'echarts/charts'
import { GraphicComponent, GridComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { useCanvasWatermarkEnabled } from '~/components/ECharts/shared/watermark'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { ChartContainer } from '../shared/ChartContainer'
import { ChartHeader } from '../shared/ChartHeader'
import { useChartTheme } from '../shared/chartTheme'
import { formatChartValue } from '../shared/formatters'
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
const MOBILE_LABEL_PADDING = 6
const MOBILE_LABEL_GAP = 4

type LabelRect = Pick<LabelLayoutOptionCallbackParams['labelRect'], 'x' | 'y' | 'width' | 'height'>

function labelsOverlap(a: LabelRect, b: LabelRect) {
	return (
		a.x < b.x + b.width + MOBILE_LABEL_GAP &&
		a.x + a.width + MOBILE_LABEL_GAP > b.x &&
		a.y < b.y + b.height + MOBILE_LABEL_GAP &&
		a.y + a.height + MOBILE_LABEL_GAP > b.y
	)
}

function createMobileLabelLayout(
	nodes: ISankeyChartProps['nodes'],
	getChartSize: () => { width: number; height: number }
) {
	let placedLabels: Array<LabelRect> = []
	const seenNodeIndexes = new Set<number>()

	return (params: LabelLayoutOptionCallbackParams) => {
		if (params.dataType !== 'node' || params.dataIndex == null) return { hideOverlap: false }

		if (seenNodeIndexes.has(params.dataIndex)) {
			seenNodeIndexes.clear()
			placedLabels = []
		}
		seenNodeIndexes.add(params.dataIndex)

		const { width: chartWidth, height: chartHeight } = getChartSize()
		const labelRect = params.labelRect
		const maxLeft = Math.max(MOBILE_LABEL_PADDING, chartWidth - labelRect.width - MOBILE_LABEL_PADDING)
		const left = Math.min(Math.max(labelRect.x, MOBILE_LABEL_PADDING), maxLeft)
		const maxTop = Math.max(MOBILE_LABEL_PADDING, chartHeight - labelRect.height - MOBILE_LABEL_PADDING)
		const originalTop = Math.min(Math.max(labelRect.y, MOBILE_LABEL_PADDING), maxTop)
		const levelHeight = labelRect.height + MOBILE_LABEL_GAP
		const depth = nodes[params.dataIndex]?.depth ?? params.dataIndex
		const direction = depth % 2 === 0 ? 1 : -1
		const startingLevel = (depth % 3) - 1
		const levelCount = Math.ceil(chartHeight / Math.max(levelHeight, 1)) + 2
		const levels = [startingLevel, 0]

		for (let level = 1; level <= levelCount; level += 1) {
			levels.push(startingLevel + level * direction, startingLevel - level * direction)
		}

		let selectedTop = originalTop
		let fewestCollisions = Number.POSITIVE_INFINITY
		const checkedTops = new Set<number>()

		for (const level of levels) {
			const top = Math.min(Math.max(originalTop + level * levelHeight, MOBILE_LABEL_PADDING), maxTop)
			if (checkedTops.has(top)) continue
			checkedTops.add(top)

			const candidate = { x: left, y: top, width: labelRect.width, height: labelRect.height }
			const collisions = placedLabels.reduce((count, placed) => count + Number(labelsOverlap(candidate, placed)), 0)
			if (collisions === 0) {
				selectedTop = top
				break
			}
			if (collisions < fewestCollisions) {
				fewestCollisions = collisions
				selectedTop = top
			}
		}

		placedLabels.push({ x: left, y: selectedTop, width: labelRect.width, height: labelRect.height })

		return {
			x: left,
			y: selectedTop + labelRect.height / 2,
			align: 'left' as const,
			verticalAlign: 'middle' as const,
			hideOverlap: false
		}
	}
}

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
	const { chartInstance: exportChartInstance, handleChartReady } = useChartImageExport()
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

	// Create maps for node metadata (descriptions, display values, and percentage labels)
	const nodeMetadata = useMemo(() => {
		const descriptions: Record<string, string> = {}
		const displayValues: Record<string, number | string> = {}
		const percentageLabels: Record<string, string> = {}
		for (const node of nodes) {
			if (node.description) {
				descriptions[node.name] = node.description
			}
			if (node.displayValue !== undefined) {
				displayValues[node.name] = node.displayValue
			}
			if (node.percentageLabel) {
				percentageLabels[node.name] = node.percentageLabel
			}
		}
		return { descriptions, displayValues, percentageLabels }
	}, [nodes])

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
					// Use displayValue if provided, otherwise use calculated value
					const displayValue = nodeMetadata.displayValues[params.name]
					const formattedValue =
						displayValue !== undefined
							? typeof displayValue === 'string'
								? displayValue
								: formatSankeyValue(displayValue)
							: formatSankeyValue(params.value)

					// Add percentage label if provided
					const percentageLabel = nodeMetadata.percentageLabels[params.name]
					const valueWithPercent = percentageLabel ? `${formattedValue} (${percentageLabel})` : formattedValue

					const description = nodeMetadata.descriptions[params.name]
					if (description && !isSmall) {
						// Truncate description to ~50 chars for display under label
						const truncatedDesc = description.length > 50 ? `${description.slice(0, 47)}...` : description
						return `{name|${params.name}: ${valueWithPercent}}\n{desc|${truncatedDesc}}`
					}
					return `${params.name}: ${valueWithPercent}`
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
					return `${params.data.source ?? ''} → ${params.data.target ?? ''}<br/>${formatSankeyValue(params.data.value ?? 0)}`
				}
				// Use displayValue if provided for tooltip value
				const displayValue = nodeMetadata.displayValues[params.name]
				const valueToShow =
					displayValue !== undefined
						? typeof displayValue === 'string'
							? displayValue
							: formatSankeyValue(displayValue)
						: formatSankeyValue(params.value)
				// Add percentage label if provided
				const percentageLabel = nodeMetadata.percentageLabels[params.name]
				const valueWithPercent = percentageLabel ? `${valueToShow} (${percentageLabel})` : valueToShow
				const description = nodeMetadata.descriptions[params.name]
				if (description) {
					return `<strong>${params.name}</strong><br/>${valueWithPercent}<br/><span style="color: var(--text-secondary); font-size: 11px;">${description}</span>`
				}
				return `${params.name}<br/>${valueWithPercent}`
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

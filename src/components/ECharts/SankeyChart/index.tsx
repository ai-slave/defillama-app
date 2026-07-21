import type { EChartsOption } from 'echarts'
import { SankeyChart as ESankeyChart, type SankeySeriesOption } from 'echarts/charts'
import { GraphicComponent, GridComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { abbreviateNumber } from '~/utils'
import { ChartContainer } from '../shared/ChartContainer'
import { ChartHeader } from '../shared/ChartHeader'
import { useChartTheme } from '../shared/chartTheme'
import { formatTooltipValue } from '../shared/formatters'
import type { ISankeyChartProps } from './types'

echarts.use([CanvasRenderer, ESankeyChart, TooltipComponent, TitleComponent, GridComponent, GraphicComponent])

interface SankeyFormatterParams {
	data?: { source?: string; target?: string; value?: number }
	dataType?: string
	name: string
	value: number
}

function normalizeSankeyFormatterParams(params: unknown): SankeyFormatterParams {
	if (!params || typeof params !== 'object') return { name: '', value: 0 }
	const candidate = params as Partial<SankeyFormatterParams>
	return {
		...candidate,
		name: candidate.name ?? '',
		value: typeof candidate.value === 'number' ? candidate.value : Number(candidate.value ?? 0)
	}
}

export default function SankeyChart({
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
	const [isDark] = useDarkModeManager()
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const chartTheme = useChartTheme(isDark)
	const { chartInstance: exportChartInstance, handleChartReady } = useChartImageExport()
	const exportFilename = imageExportFilename || (title ? title.replace(/\s+/g, '-').toLowerCase() : 'sankey-chart')
	const exportTitle = imageExportTitle || title
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const onReadyRef = useRef(onReady)
	const formatSankeyValue = useCallback(
		(value: number): string => {
			return abbreviateNumber(value, 2, valueSymbol) ?? formatTooltipValue(value, valueSymbol)
		},
		[valueSymbol]
	)

	useEffect(() => {
		onReadyRef.current = onReady
	})

	// Create maps for node metadata (descriptions, display values, and percentage labels)
	const nodeMetadata = useMemo(() => {
		const descriptions = {}
		const displayValues = {}
		const percentageLabels = {}
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
		const nodeData = nodes.map((node) => ({
			name: node.name,
			itemStyle: {
				color: nodeColors?.[node.name] ?? node.color ?? undefined
			},
			...(node.depth !== undefined ? { depth: node.depth } : {})
		}))

		return {
			type: 'sankey',
			layout: 'none',
			nodeAlign,
			orient,
			emphasis: {
				focus: 'adjacency'
			},
			nodeGap: 24,
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
						const truncatedDesc = description.length > 50 ? description.slice(0, 47) + '...' : description
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
			links: links.map((link) => ({
				source: link.source,
				target: link.target,
				value: link.value,
				lineStyle: link.color ? { color: link.color } : undefined
			}))
		}
	}, [nodes, links, nodeColors, nodeAlign, orient, chartTheme, isSmall, formatSankeyValue, nodeMetadata])

	const option = useMemo<EChartsOption>(() => {
		const graphic = {
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

		return {
			graphic,
			tooltip: {
				trigger: 'item',
				triggerOn: 'mousemove',
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
			},
			series
		}
	}, [series, isDark, isSmall, nodeMetadata, formatSankeyValue])

	const initializeChart = useCallback(() => {
		const currentInstance = chartRef.current
		if (currentInstance && !currentInstance.isDisposed()) return

		const element = containerRef.current
		if (!element?.isConnected) return
		const bounds = element.getBoundingClientRect()
		// Enterprise dashboard tabs stay mounted under `display: none`. Initializing or laying
		// out a Sankey at 0x0 can leave ECharts with incomplete renderer state. ResizeObserver
		// calls this again with real dimensions when the tab becomes visible.
		if (bounds.width <= 0 || bounds.height <= 0) return

		const instance = echarts.init(element, null, { renderer: 'canvas' })
		chartRef.current = instance
		handleChartReady(instance)
		onReadyRef.current?.(instance)
		instance.setOption(option, { notMerge: true })
	}, [handleChartReady, option])

	// The observer both resizes an existing chart and performs deferred initialization when
	// a chart's hidden tab is shown for the first time.
	useChartResize(chartRef, containerRef, initializeChart)

	useEffect(() => {
		const instance = chartRef.current
		if (!instance || instance.isDisposed()) {
			initializeChart()
			return
		}
		instance.setOption(option, { notMerge: true })
	}, [initializeChart, option])

	useEffect(() => {
		return () => {
			const instance = chartRef.current
			chartRef.current = null
			handleChartReady(null)
			onReadyRef.current?.(null)
			if (instance && !instance.isDisposed()) instance.dispose()
		}
	}, [handleChartReady])

	return (
		<ChartContainer
			chartRef={containerRef}
			chartClassName=""
			chartStyle={{ height }}
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

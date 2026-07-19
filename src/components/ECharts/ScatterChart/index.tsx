import { ScatterChart as EChartScatter } from 'echarts/charts'
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
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formattedNum } from '~/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { CHART_INSET } from '../chartSpacing'
import { useChartTheme } from '../chartTheme'
import type { IScatterChartProps } from '../types'
import { isIconUrlValid, validateIconUrl } from '../utils'

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

function getPointValue(point: any): any[] {
	if (Array.isArray(point)) return point
	return Array.isArray(point?.value) ? point.value : []
}

export default function ScatterChart({
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
	onReady
}: IScatterChartProps) {
	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})
	const [iconRevision, setIconRevision] = useState(0)

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	useEffect(() => {
		if (!showLabels) return
		const slugs = new Set<string>()
		for (const point of chartData as any[]) {
			if (point?.showLabel === false) continue
			const slug = point?.entitySlug ?? getPointValue(point)[3]
			if (slug && typeof slug === 'string' && slug.toLowerCase() !== 'unknown') slugs.add(slug)
		}
		const pending: Promise<boolean>[] = []
		for (const slug of slugs) {
			pending.push(validateIconUrl(getEntityIcon(entityType, slug)))
		}
		if (pending.length === 0) return
		let cancelled = false
		Promise.all(pending).then(() => {
			if (!cancelled) setIconRevision((v) => v + 1)
		})
		return () => {
			cancelled = true
		}
	}, [chartData, entityType, showLabels])

	useEffect(() => {
		const chartDom = containerRef.current
		if (!chartDom) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance
		emitReady(instance)

		return () => {
			chartRef.current = null
			emitReady(null)
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		let series = []
		const isYieldData = chartData.length > 0 && chartData[0].projectName !== undefined

		const labelConfig = {
			show: showLabels,
			position: 'right' as const,
			distance: 5,
			formatter: (params: any) => params.value?.[2] || '',
			fontSize: 10,
			fontWeight: 500,
			color: chartTheme.ink(0.86)
		}

		if (isYieldData) {
			const pointsByProject = new Map<
				string | number | null | undefined,
				Array<Array<string | number | null | undefined>>
			>()
			for (const point of chartData) {
				let points = pointsByProject.get(point.projectName)
				if (!points) {
					points = []
					pointsByProject.set(point.projectName, points)
				}
				points.push([
					point.sigma,
					point.mu,
					point.count,
					point.symbol,
					point.pool,
					point.tvlUsd,
					point.apy,
					point.chain
				])
			}
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
			const dataWithSymbols = showLabels
				? chartData.map((point: any) => {
						const normalizedPoint = Array.isArray(point) ? { value: point } : point
						if (point?.showLabel === false) return normalizedPoint
						const slug = point?.entitySlug ?? getPointValue(point)[3] ?? ''
						if (!slug || typeof slug !== 'string' || slug.toLowerCase() === 'unknown') return normalizedPoint
						const url = getEntityIcon(entityType, slug)
						if (!isIconUrlValid(url)) return normalizedPoint
						return {
							...normalizedPoint,
							symbol: `image://${url}`,
							symbolSize: Math.max(Number(normalizedPoint?.symbolSize) || 20, 18)
						}
					})
				: chartData

			const groupedData = new Map<string, any[]>()
			for (const point of dataWithSymbols as any[]) {
				const seriesName = typeof point?.seriesName === 'string' ? point.seriesName : title || 'Data'
				if (!groupedData.has(seriesName)) groupedData.set(seriesName, [])
				groupedData.get(seriesName)!.push(point)
			}

			series = [...groupedData.entries()].map(([seriesName, data]) => {
				const groupColor = data.find((point) => typeof point?.groupColor === 'string')?.groupColor
				return {
					name: seriesName,
					type: 'scatter',
					symbolSize: showLabels ? 20 : 8,
					itemStyle: {
						...(groupColor ? { color: groupColor } : {}),
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
					data
				}
			})
		}

		const showCategoricalLegend = !isYieldData && series.length > 1

		const yieldTooltipFormatter = (params) => {
			if (params.value.length > 1) {
				return (
					'Symbol: ' +
					params.value[3] +
					'<br/>' +
					'Pool: ' +
					params.value[4] +
					'<br/>' +
					'TVL: ' +
					formattedNum(params.value[5], true) +
					'<br/>' +
					'APY Spot: ' +
					params.value[6].toFixed(2) +
					'%' +
					'<br/>' +
					'Chain: ' +
					params.value[7] +
					'<br/>' +
					'Project: ' +
					params.seriesName +
					'<br/>' +
					'APY Geometric Average: ' +
					params.value[1].toFixed(2) +
					'%' +
					'<br/>' +
					'APY Standard Deviation: ' +
					params.value[0].toFixed(2) +
					'%' +
					'<br/>' +
					'Nb of collected daily datapoints: ' +
					params.value[2]
				)
			} else {
				return params.seriesName + ' :<br/>' + params.name + ' : ' + params.value.toFixed(5) + 'mean '
			}
		}

		const genericTooltipFormatter = (params) => {
			if (params.value && params.value.length >= 2) {
				const xValue = params.value[0]
				const yValue = params.value[1]
				const entityName = params.value[2]
				const formatValue = (val) => {
					if (valueSymbol === '$') return formattedNum(val, true)
					if (valueSymbol === '%') return val.toFixed(2) + '%'
					return formattedNum(val)
				}
				let tooltip = ''
				if (entityName) {
					tooltip += `<strong>${entityName}</strong><br/>`
				}
				tooltip += `${xAxisLabel || 'X'}: ${formatValue(xValue)}<br/>`
				tooltip += `${yAxisLabel || 'Y'}: ${formatValue(yValue)}`
				return tooltip
			}
			return ''
		}

		const effectiveTooltipFormatter =
			tooltipFormatter || (isYieldData ? yieldTooltipFormatter : genericTooltipFormatter)

		const option = {
			title: title
				? {
						text: title,
						textStyle: {
							fontFamily: 'sans-serif',
							fontWeight: 600,
							color: chartTheme.text
						}
					}
				: undefined,
			legend: showCategoricalLegend
				? {
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
				: undefined,
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
				formatter: effectiveTooltipFormatter,
				axisPointer: {
					show: true,
					type: 'cross',
					lineStyle: {
						type: 'dashed',
						width: 1
					}
				}
			},
			toolbox: {
				feature: {
					dataZoom: {},
					restore: {}
				}
			},
			xAxis: [
				{
					type: logScale ? 'log' : 'value',
					scale: true,
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
					type: logScale ? 'log' : 'value',
					scale: true,
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
			dataZoom: [
				{
					type: 'inside',
					start: 0,
					end: 100,
					filterMode: 'none'
				}
			],
			labelLayout: { hideOverlap: true },
			series: series
		}

		instance.setOption(option, { notMerge: true })
	}, [
		chartData,
		isDark,
		chartTheme,
		tooltipFormatter,
		xAxisLabel,
		yAxisLabel,
		valueSymbol,
		title,
		showLabels,
		entityType,
		logScale,
		iconRevision
	])

	return (
		<div>
			<div ref={containerRef} className="h-[360px]" style={height ? { height } : undefined} />
		</div>
	)
}

import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useMemo, useRef } from 'react'
import { useChartResize } from '~/hooks/useChartResize'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

type PrimitiveSparklinePoint = [number, number]
type RgbColor = [number, number, number]

let colorParserContext: CanvasRenderingContext2D | null | undefined
const rgbColorCache = new Map<string, RgbColor | null>()

function parseRgbColor(base: string): RgbColor | null {
	const cached = rgbColorCache.get(base)
	if (cached !== undefined) return cached

	if (colorParserContext === undefined) {
		const canvas = document.createElement('canvas')
		canvas.width = canvas.height = 1
		colorParserContext = canvas.getContext('2d')
	}
	const context = colorParserContext
	if (!context) return null
	context.fillStyle = '#000'
	context.fillStyle = base
	const computed = context.fillStyle
	let output: RgbColor | null = null

	if (typeof computed === 'string' && computed.startsWith('#')) {
		const hex = computed.slice(1)
		if (hex.length === 3) {
			output = [
				Number.parseInt(hex[0] + hex[0], 16),
				Number.parseInt(hex[1] + hex[1], 16),
				Number.parseInt(hex[2] + hex[2], 16)
			]
		} else if (hex.length === 6 || hex.length === 8) {
			output = [
				Number.parseInt(hex.slice(0, 2), 16),
				Number.parseInt(hex.slice(2, 4), 16),
				Number.parseInt(hex.slice(4, 6), 16)
			]
		}
	} else if (typeof computed === 'string') {
		const rgbMatch = computed.match(/rgba?\(([^)]+)\)/)
		if (rgbMatch) {
			const values = rgbMatch[1]
				.split(',')
				.slice(0, 3)
				.map((part) => Number.parseInt(part.trim(), 10))
			if (values.every(Number.isFinite)) output = values as RgbColor
		}
	}

	rgbColorCache.set(base, output)
	return output
}

interface SparklineChartProps {
	data?: PrimitiveSparklinePoint[]
	color?: string
	areaColor?: string
	className?: string
	height?: number | string
	smooth?: boolean
	focusable?: boolean
}

export function SparklineChart({
	data,
	color = 'var(--bg-brand)',
	areaColor,
	className,
	height = 48,
	smooth = true,
	focusable
}: SparklineChartProps) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	const seriesData = useMemo(() => {
		if (!data) return []
		const points: PrimitiveSparklinePoint[] = []
		for (const [timestamp, value] of data) {
			points.push([timestamp * 1000, value])
		}
		return points
	}, [data])
	const hasData = seriesData.length > 0

	useEffect(() => {
		if (!hasData) return
		const dom = containerRef.current
		if (!dom) return
		const instance = echarts.init(dom, undefined, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [hasData])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const resolveColor = (input?: string) => {
			if (!input) return undefined
			const match = input.match(/^var\(([^)]+)\)$/)
			if (!match) {
				return input
			}
			const [variable, fallback] = match[1].split(',').map((part) => part.trim())
			let value = ''
			try {
				const target: HTMLElement = document.documentElement
				value = getComputedStyle(target).getPropertyValue(variable)
			} catch {
				value = ''
			}
			return value?.trim() || fallback || input
		}

		let resolvedLine = resolveColor(color) || color
		if (resolvedLine.startsWith('var(')) {
			resolvedLine = '#6BA5FF'
		}

		let resolvedArea = resolveColor(areaColor) || resolvedLine
		if (resolvedArea.startsWith('var(')) {
			resolvedArea = resolvedLine
		}

		const rgb = areaColor ? null : parseRgbColor(resolvedLine)
		const areaFill = areaColor
			? resolvedArea
			: rgb
				? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.28)` },
						{ offset: 1, color: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.04)` }
					])
				: resolvedLine

		const shadowColor = rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)` : resolvedLine

		if (instance.isDisposed()) return

		instance.setOption(
			{
				grid: {
					left: 0,
					right: 0,
					top: 2,
					bottom: 0,
					containLabel: false
				},
				animation: false,
				tooltip: {
					show: false
				},
				xAxis: {
					type: 'time',
					boundaryGap: false,
					axisLine: { show: false },
					axisTick: { show: false },
					axisLabel: { show: false },
					splitLine: { show: false },
					min: seriesData[0]?.[0],
					max: seriesData[seriesData.length - 1]?.[0]
				},
				yAxis: {
					type: 'value',
					axisLine: { show: false },
					axisTick: { show: false },
					axisLabel: { show: false },
					splitLine: { show: false },
					min: (value) => {
						if (typeof value.min !== 'number' || typeof value.max !== 'number') return undefined
						if (value.min === value.max) {
							const pad = Math.abs(value.min) * 0.05 || 1
							return value.min - pad
						}
						const pad = (value.max - value.min) * 0.08
						return value.min - pad
					},
					max: (value) => {
						if (typeof value.min !== 'number' || typeof value.max !== 'number') return undefined
						if (value.min === value.max) {
							const pad = Math.abs(value.max) * 0.05 || 1
							return value.max + pad
						}
						const pad = (value.max - value.min) * 0.08
						return value.max + pad
					}
				},
				series: [
					{
						type: 'line',
						data: seriesData,
						showSymbol: false,
						lineStyle: {
							color: resolvedLine,
							width: 2,
							cap: 'round',
							join: 'round',
							shadowBlur: rgb ? 6 : 0,
							shadowColor
						},
						smooth,
						smoothMonotone: 'x',
						areaStyle: {
							color: areaFill
						}
					}
				]
			},
			true
		)
	}, [seriesData, color, areaColor, smooth])

	if (!hasData) {
		return null
	}

	return (
		<div
			ref={containerRef}
			className={className}
			style={{ width: '100%', height, outline: 'none', pointerEvents: 'none' }}
			tabIndex={focusable ? 0 : -1}
		/>
	)
}

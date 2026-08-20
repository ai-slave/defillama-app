import type { EChartsOption } from 'echarts'
import { BarChart, CandlestickChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef, type ReactNode } from 'react'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { formatCompactNumber, formatNumber } from '~/utils/numberFormat'

echarts.use([LineChart, BarChart, CandlestickChart, GridComponent, TooltipComponent, CanvasRenderer])

export type SimpleSeriesPoint = [number, number]

export type SimpleCandle = {
	time: number
	open: number
	close: number
	low: number
	high: number
}

export type SimpleSeries = {
	name: string
	type: 'line' | 'area' | 'bar'
	color: string
	data: SimpleSeriesPoint[]
	stack?: string
}

export type AxisFormat = 'usd' | 'pct'

function formatAxisValue(value: number, format: AxisFormat): string {
	return format === 'pct'
		? `${formatNumber(value, { maximumSignificantDigits: 3 })}%`
		: `$${formatCompactNumber(value)}`
}

function baseOption(axisColor?: string, format: AxisFormat = 'usd'): EChartsOption {
	return {
		useUTC: true,
		grid: { left: 56, right: 16, top: 8, bottom: 28 },
		tooltip: {
			trigger: 'axis',
			valueFormatter: (value) => (typeof value === 'number' ? formatAxisValue(value, format) : String(value ?? ''))
		},
		xAxis: {
			type: 'time',
			axisLabel: axisColor ? { color: axisColor } : undefined,
			splitLine: { show: false }
		},
		yAxis: {
			type: 'value',
			axisLabel: {
				color: axisColor,
				formatter: (value: number) => formatAxisValue(value, format)
			},
			splitLine: { lineStyle: { opacity: 0.15 } }
		}
	}
}

function toEChartsSeries(entry: SimpleSeries, yAxisIndex?: number) {
	return {
		name: entry.name,
		type: (entry.type === 'bar' ? 'bar' : 'line') as 'bar' | 'line',
		stack: entry.stack,
		yAxisIndex,
		showSymbol: false,
		smooth: false,
		lineStyle: entry.type === 'bar' ? undefined : { color: entry.color, width: 1.5 },
		itemStyle: { color: entry.color },
		areaStyle: entry.type === 'area' ? { color: entry.color, opacity: 0.35 } : undefined,
		data: entry.data
	}
}

export function buildSeriesOption(
	series: SimpleSeries[],
	axisColor?: string,
	format: AxisFormat = 'usd',
	yTicks?: number
): EChartsOption {
	const base = baseOption(axisColor, format)
	return {
		...base,
		yAxis: yTicks == null ? base.yAxis : { ...(base.yAxis as object), splitNumber: yTicks },
		series: series.map((entry) => toEChartsSeries(entry))
	}
}

export function buildDualAxisOption(
	left: SimpleSeries,
	right: SimpleSeries,
	axisColor?: string,
	format: AxisFormat = 'usd'
): EChartsOption {
	const base = baseOption(axisColor, format)
	return {
		...base,
		grid: { left: 56, right: 56, top: 8, bottom: 28 },
		yAxis: [left, right].map((entry) => ({
			type: 'value' as const,
			axisLabel: {
				color: entry.color,
				formatter: (value: number) => formatAxisValue(value, format)
			},
			splitLine: { lineStyle: { opacity: 0.15 } }
		})),
		series: [toEChartsSeries(left, 0), toEChartsSeries(right, 1)]
	}
}

export function ChartCaption({ children }: { children: ReactNode }) {
	return <p className="-mb-2 text-center label-sm text-secondary">{children}</p>
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-4">
			{items.map((item) => (
				<span key={item.label} className="flex items-center gap-1.5 body-sm text-secondary">
					<span className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
					{item.label}
				</span>
			))}
		</div>
	)
}

export function buildCandleOption(candles: SimpleCandle[], axisColor?: string): EChartsOption {
	return {
		...baseOption(axisColor),
		yAxis: {
			type: 'value',
			scale: true,
			axisLabel: { color: axisColor, formatter: (value: number) => formatAxisValue(value, 'usd') },
			splitLine: { lineStyle: { opacity: 0.15 } }
		},
		series: [
			{
				type: 'candlestick',
				data: candles.map((candle) => ({
					value: [candle.open, candle.close, candle.low, candle.high],
					name: new Date(candle.time).toISOString().slice(0, 10)
				})),
				itemStyle: { color: '#11935f', color0: '#b23a38', borderColor: '#11935f', borderColor0: '#b23a38' }
			}
		],
		xAxis: {
			type: 'category',
			data: candles.map((candle) => new Date(candle.time).toISOString().slice(5, 10)),
			axisLabel: axisColor ? { color: axisColor } : undefined
		}
	}
}

export function SimpleChart({ option, className = 'h-[200px] w-full' }: { option: EChartsOption; className?: string }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)

	useChartResize(chartRef, containerRef)

	useEffect(() => {
		const chartDom = containerRef.current
		if (!chartDom) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance
		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		instance.setOption(option, { notMerge: true })
	}, [option])

	return <div ref={containerRef} className={className} />
}

export function useChartAxisColor(): string | undefined {
	const [isDark] = useDarkModeManager()
	return useChartTheme(isDark).axisLabel
}

import { BarChart } from 'echarts/charts'
import { GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '../chartSpacing'
import { useChartTheme } from '../chartTheme'
import { formatTooltipValue } from '../formatters'
import type { IHBarChartProps } from '../types'

echarts.use([CanvasRenderer, BarChart, GraphicComponent, GridComponent, LegendComponent, TooltipComponent])

function getYAxisLabelWidth(containerWidth: number) {
	return Math.min(Math.max(containerWidth * 0.2, 100), 300)
}

const LOGO_SIZE = 18
const LOGO_GAP = 8
const LEFT_PAD = 12
const LABEL_FONT = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const LABEL_MAX_WIDTH = 240

let _measureCtx: CanvasRenderingContext2D | null = null
function measureLabelWidth(text: string): number {
	if (!_measureCtx) {
		const c = document.createElement('canvas')
		_measureCtx = c.getContext('2d')
	}
	if (!_measureCtx) return text.length * 7
	_measureCtx.font = LABEL_FONT
	return Math.ceil(_measureCtx.measureText(text).width)
}

export default function HBarChart({
	categories,
	values,
	title: _title,
	valueSymbol = '$',
	height = '360px',
	color = '#1f77b4',
	colors,
	logos,
	series,
	valueAxisMin,
	valueAxisMax,
	valueAxisInterval,
	onReady
}: IHBarChartProps) {
	const grouped = series != null && series.length > 1
	const [isThemeDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isThemeDark)
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const overlayRef = useRef<HTMLDivElement>(null)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	// All-or-nothing logos: sparse icons (some 404) look worse than none and throw off left-margin
	// alignment between sibling charts. Preload every logo and only enable the overlay if ALL load.
	const [logosAllLoaded, setLogosAllLoaded] = useState(false)
	useEffect(() => {
		const complete = !!logos && logos.length === categories.length && logos.every(Boolean)
		if (!complete) {
			setLogosAllLoaded(false)
			return
		}
		let cancelled = false
		Promise.all(
			logos!.map(
				(url) =>
					new Promise<boolean>((resolve) => {
						const img = new Image()
						img.onload = () => resolve(true)
						img.onerror = () => resolve(false)
						img.src = url
					})
			)
		).then((results) => {
			if (!cancelled) setLogosAllLoaded(results.every(Boolean))
		})
		return () => {
			cancelled = true
		}
	}, [logos, categories])

	const hasLogos = logosAllLoaded
	const textColor = chartTheme.axisLabel
	let overlayLabelWidth = 0
	if (hasLogos) {
		for (const category of categories) overlayLabelWidth = Math.max(overlayLabelWidth, measureLabelWidth(category))
		overlayLabelWidth = Math.min(LABEL_MAX_WIDTH, overlayLabelWidth)
	}

	const syncLogos = useEffectEvent(() => {
		const layer = overlayRef.current
		const instance = chartRef.current
		if (!layer) return
		layer.innerHTML = ''
		if (!instance || instance.isDisposed() || !hasLogos) return

		for (let i = 0; i < categories.length; i++) {
			const y = instance.convertToPixel({ yAxisIndex: 0 }, i)
			if (typeof y !== 'number' || !Number.isFinite(y)) continue
			const url = logos![i]
			const row = document.createElement('div')
			row.style.cssText = `position:absolute;left:${LEFT_PAD}px;top:${y - LOGO_SIZE / 2}px;height:${LOGO_SIZE}px;pointer-events:none;white-space:nowrap;`
			const spacerCss = `display:inline-block;width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;vertical-align:middle;`
			if (url) {
				const img = document.createElement('img')
				img.src = url
				img.alt = ''
				img.loading = 'lazy'
				img.decoding = 'async'
				img.style.cssText = `width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;border-radius:50%;object-fit:cover;background:${chartTheme.logoBg};display:inline-block;vertical-align:middle;`
				img.onerror = () => {
					const spacer = document.createElement('span')
					spacer.style.cssText = spacerCss
					img.replaceWith(spacer)
				}
				row.appendChild(img)
			} else {
				const spacer = document.createElement('span')
				spacer.style.cssText = spacerCss
				row.appendChild(spacer)
			}
			const text = document.createElement('span')
			text.textContent = categories[i]
			text.title = categories[i]
			text.style.cssText = `display:inline-block;vertical-align:middle;color:${textColor};font-size:12px;line-height:${LOGO_SIZE}px;margin-left:${LOGO_GAP}px;max-width:${overlayLabelWidth}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`
			row.appendChild(text)
			layer.appendChild(row)
		}
	})

	const handleResize = useEffectEvent((width: number) => {
		const instance = chartRef.current
		if (!instance || instance.isDisposed()) return
		instance.resize()
		if (!hasLogos) {
			instance.setOption({ yAxis: { axisLabel: { width: getYAxisLabelWidth(width) } } })
		}
		syncLogos()
	})

	useEffect(() => {
		const chartDom = containerRef.current
		if (!chartDom) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance
		emitReady(instance)
		instance.on('finished', syncLogos)

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (entry) handleResize(entry.contentRect.width)
		})
		observer.observe(chartDom)

		return () => {
			observer.disconnect()
			instance.off('finished', syncLogos)
			chartRef.current = null
			emitReady(null)
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const chartDom = containerRef.current
		const instance = chartRef.current
		if (!chartDom || !instance) return

		const barSeries = grouped
			? series!.map((s) => ({
					name: s.name,
					type: 'bar' as const,
					data: s.values,
					itemStyle: { color: s.color },
					barMaxWidth: 22
				}))
			: [
					{
						type: 'bar' as const,
						data: values.map((value, index) => {
							const item: { value: number; itemStyle?: { color: string } } = { value }
							const barColor = colors?.[index] ?? color
							if (barColor) item.itemStyle = { color: barColor }
							return item
						}),
						emphasis: { focus: 'series' as const }
					}
				]

		const yAxisLabelWidth = getYAxisLabelWidth(chartDom.clientWidth || 600)
		const watermarkHeight = 40
		const watermarkWidth = Math.round((389 / 133) * watermarkHeight)
		const leftGridWidth = hasLogos ? LEFT_PAD + LOGO_SIZE + LOGO_GAP + overlayLabelWidth + 8 : CHART_INSET

		instance.setOption(
			{
				graphic: [
					{
						type: 'image',
						zlevel: 10,
						z: 999,
						silent: true,
						left: 'center',
						top: 'middle',
						style: {
							image: isThemeDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
							width: watermarkWidth,
							height: watermarkHeight,
							opacity: 0.3
						}
					}
				],
				...(grouped
					? {
							legend: {
								show: true,
								top: 8,
								left: 'center',
								textStyle: { color: chartTheme.text },
								data: series!.map((s) => s.name)
							}
						}
					: {}),
				grid: {
					left: leftGridWidth,
					right: CHART_INSET,
					top: grouped ? CHART_LEGEND_RESERVE : CHART_INSET,
					bottom: CHART_INSET,
					outerBoundsMode: 'same',
					outerBoundsContain: hasLogos ? undefined : 'axisLabel'
				},
				xAxis: {
					type: 'value',
					...(valueAxisMin !== undefined ? { min: valueAxisMin } : {}),
					...(valueAxisMax !== undefined ? { max: valueAxisMax } : {}),
					...(valueAxisInterval !== undefined ? { interval: valueAxisInterval } : {}),
					axisLabel: {
						color: textColor,
						formatter: (value: number) => formatTooltipValue(value, valueSymbol)
					},
					splitLine: {
						lineStyle: {
							color: chartTheme.gridline
						}
					}
				},
				yAxis: {
					type: 'category',
					data: categories,
					inverse: true,
					axisLine: { show: !hasLogos },
					axisTick: { show: !hasLogos },
					axisLabel: hasLogos ? { show: false } : { color: textColor, width: yAxisLabelWidth, overflow: 'truncate' }
				},
				tooltip: {
					trigger: 'axis',
					className: 'defillama-echarts-tooltip',
					backgroundColor: 'transparent',
					borderWidth: 0,
					axisPointer: { type: 'shadow' },
					formatter: (params: any) => {
						if (!Array.isArray(params) || !params[0]) return ''
						const p = params[0]
						const numericValue = typeof p.value === 'number' ? p.value : (p.data?.value ?? 0)
						const header = `<div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>`
						if (!grouped) return `${header}<div>${formatTooltipValue(numericValue, valueSymbol)}</div>`
						let rows = ''
						for (const item of params) {
							const value = typeof item.value === 'number' ? item.value : (item.data?.value ?? 0)
							rows += `<div>${item.marker ?? ''}${item.seriesName}: ${formatTooltipValue(value, valueSymbol)}</div>`
						}
						return header + rows
					}
				},
				series: barSeries
			},
			true
		)

		if (hasLogos) {
			;(instance as any).__llamaChartLogos = {
				kind: 'hbar',
				logos: logos!,
				categories
			}
		} else {
			delete (instance as any).__llamaChartLogos
		}

		const syncLogosFrame = requestAnimationFrame(syncLogos)

		return () => {
			cancelAnimationFrame(syncLogosFrame)
		}
	}, [
		categories,
		values,
		valueSymbol,
		color,
		colors,
		logos,
		series,
		grouped,
		valueAxisMin,
		valueAxisMax,
		valueAxisInterval,
		hasLogos,
		isThemeDark,
		chartTheme,
		overlayLabelWidth,
		textColor
	])

	return (
		<div style={{ position: 'relative', height }}>
			<div ref={containerRef} style={{ width: '100%', height: '100%' }} />
			<div ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden />
		</div>
	)
}

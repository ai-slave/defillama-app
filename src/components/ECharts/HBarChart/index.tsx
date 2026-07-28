import type { EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { setChartLogoMetadata } from '../shared/chartLogoMetadata'
import { CHART_INSET, CHART_LEGEND_RESERVE } from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { formatTooltipValue } from '../shared/formatters'
import { getTooltipRawYValue, normalizeTooltipItems } from '../shared/tooltip'
import { buildWatermarkGraphic } from '../shared/watermark'
import type { IHBarChartProps } from './types'

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

function HBarChart({
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
	const persistentLifecycle = usePersistentEChartsLifecycle()
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
	const logoRenderStateRef = useRef({
		hasLogos,
		categories,
		logos,
		logoBg: chartTheme.logoBg,
		textColor,
		overlayLabelWidth
	})
	logoRenderStateRef.current = {
		hasLogos,
		categories,
		logos,
		logoBg: chartTheme.logoBg,
		textColor,
		overlayLabelWidth
	}

	const syncLogos = useCallback(() => {
		const layer = overlayRef.current
		const instance = chartRef.current
		const {
			hasLogos: shouldRenderLogos,
			categories: currentCategories,
			logos: currentLogos,
			logoBg,
			textColor: currentTextColor,
			overlayLabelWidth: currentLabelWidth
		} = logoRenderStateRef.current
		if (!layer) return
		layer.innerHTML = ''
		if (!instance || instance.isDisposed() || !shouldRenderLogos) return

		for (let i = 0; i < currentCategories.length; i++) {
			const category = currentCategories[i]!
			const y = instance.convertToPixel({ yAxisIndex: 0 }, i)
			if (typeof y !== 'number' || !Number.isFinite(y)) continue
			const url = currentLogos?.[i]
			const row = document.createElement('div')
			row.style.cssText = `position:absolute;left:${LEFT_PAD}px;top:${y - LOGO_SIZE / 2}px;height:${LOGO_SIZE}px;pointer-events:none;white-space:nowrap;`
			const spacerCss = `display:inline-block;width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;vertical-align:middle;`
			if (url) {
				const img = document.createElement('img')
				img.src = url
				img.alt = ''
				img.loading = 'lazy'
				img.decoding = 'async'
				img.style.cssText = `width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;border-radius:50%;object-fit:cover;background:${logoBg};display:inline-block;vertical-align:middle;`
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
			text.textContent = category
			text.title = category
			text.style.cssText = `display:inline-block;vertical-align:middle;color:${currentTextColor};font-size:12px;line-height:${LOGO_SIZE}px;margin-left:${LOGO_GAP}px;max-width:${currentLabelWidth}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`
			row.appendChild(text)
			layer.appendChild(row)
		}
	}, [])

	const handleElementResize = useCallback(() => {
		const chartDom = containerRef.current
		const instance = chartRef.current
		if (!chartDom || !instance || instance.isDisposed()) return
		if (!logoRenderStateRef.current.hasLogos) {
			const option: EChartsOption = { yAxis: { axisLabel: { width: getYAxisLabelWidth(chartDom.clientWidth) } } }
			instance.setOption(option)
		}
		syncLogos()
	}, [syncLogos])
	useChartResize(chartRef, containerRef, { onResize: handleElementResize })

	useEffect(() => {
		const chartDom = containerRef.current
		if (!chartDom) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		emitReady(instance)

		return () => {
			persistentLifecycle.capture(instance)
			chartRef.current = null
			emitReady(null)
			instance.dispose()
		}
	}, [persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance || instance.isDisposed()) return
		instance.on('finished', syncLogos)
		return () => {
			if (!instance.isDisposed()) instance.off('finished', syncLogos)
		}
	}, [syncLogos])

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
		const leftGridWidth = hasLogos ? LEFT_PAD + LOGO_SIZE + LOGO_GAP + overlayLabelWidth + 8 : CHART_INSET

		const option: EChartsOption = {
			graphic: [buildWatermarkGraphic(isThemeDark)],
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
				formatter: (params: unknown) => {
					const items = normalizeTooltipItems(params)
					const first = items[0]
					if (!first) return ''
					const firstRawValue = getTooltipRawYValue(first, first.seriesName ?? '')
					const numericValue = typeof firstRawValue === 'number' ? firstRawValue : Number(firstRawValue ?? 0)
					const header = `<div style="font-weight: 600; margin-bottom: 4px;">${first.name ?? ''}</div>`
					if (!grouped) return `${header}<div>${formatTooltipValue(numericValue, valueSymbol)}</div>`
					let rows = ''
					for (const item of items) {
						const name = item.seriesName ?? ''
						const rawValue = getTooltipRawYValue(item, name)
						const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)
						rows += `<div>${item.marker ?? ''}${name}: ${formatTooltipValue(value, valueSymbol)}</div>`
					}
					return header + rows
				}
			},
			series: barSeries
		}
		instance.setOption(option, true)

		if (hasLogos) {
			setChartLogoMetadata(instance, {
				kind: 'hbar',
				logos: logos!,
				categories
			})
		} else {
			setChartLogoMetadata(instance, undefined)
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
		textColor,
		syncLogos
	])

	return (
		<div style={{ position: 'relative', height }}>
			<div ref={containerRef} style={{ width: '100%', height: '100%' }} />
			<div ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden />
		</div>
	)
}

export default withEChartsRenderVisibility(HBarChart)

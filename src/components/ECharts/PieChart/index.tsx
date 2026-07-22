import type { EChartsOption } from 'echarts'
import { PieChart as EPieChart, type PieSeriesOption } from 'echarts/charts'
import { GraphicComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useMedia } from '~/hooks/useMedia'
import { useStableCallback } from '~/hooks/useStableCallback'
import { formattedNum } from '~/utils'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { ChartContainer } from '../shared/ChartContainer'
import { ChartHeader } from '../shared/ChartHeader'
import { CHART_INSET, CHART_VERTICAL_LEGEND_RIGHT_INSET, chartLegendScrollStyle } from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { formatTooltipValue } from '../shared/formatters'
import type { IPieChartProps, PieTooltipParams } from './types'

echarts.use([
	CanvasRenderer,
	EPieChart,
	TooltipComponent,
	TitleComponent,
	GridComponent,
	GraphicComponent,
	LegendComponent
])

const DEFAULT_PIE_CENTER_Y = '50%' as const

function normalizePieTooltipParams(params: unknown): PieTooltipParams {
	const value = Array.isArray(params) ? params[0] : params
	return value && typeof value === 'object' ? (value as PieTooltipParams) : {}
}

function PieChart({
	height,
	stackColors,
	chartData,
	title,
	headingAs,
	valueSymbol = '$',
	radius = null,
	centerY = DEFAULT_PIE_CENTER_Y,
	showLegend = false,
	legendPosition,
	legendTextStyle,
	toRight,
	formatTooltip,
	customLabel,
	exportButtons,
	onReady,
	...props
}: IPieChartProps) {
	const [isDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isDark)
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const persistentLifecycle = usePersistentEChartsLifecycle()

	const exportButtonsMode = exportButtons ?? 'hidden'
	const exportButtonsConfig =
		typeof exportButtonsMode === 'object' && exportButtonsMode !== null ? exportButtonsMode : undefined
	const exportButtonsHidden = exportButtonsMode === 'hidden'
	const exportButtonsAuto = exportButtonsMode === 'auto'

	const imageExportEnabled = exportButtonsHidden
		? false
		: exportButtonsConfig
			? (exportButtonsConfig.png ?? true)
			: exportButtonsAuto

	const csvDownloadEnabled = exportButtonsHidden
		? false
		: exportButtonsConfig
			? (exportButtonsConfig.csv ?? true)
			: exportButtonsAuto

	const exportFilename =
		exportButtonsConfig?.filename || (title ? title.replace(/\s+/g, '-').toLowerCase() : 'pie-chart')
	const exportTitle = exportButtonsConfig?.pngTitle || title
	const stackColorByName = useMemo(() => new Map(Object.entries(stackColors ?? {})), [stackColors])
	const chartDomRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	const { percentByName, formatPercent } = useMemo(() => {
		let total = 0
		for (const item of chartData) total += item.value

		const formatPercent = (value: number) => {
			if (total === 0) return '0%'
			const pct = (value / total) * 100
			if (pct === 0) return '0%'
			if (pct < 0.0001) return '< 0.0001%'
			if (pct < 0.01) return formattedNum(pct) + '%'
			return pct.toFixed(2) + '%'
		}

		const percentByName = new Map<string, string>()
		for (const item of chartData) percentByName.set(item.name, formatPercent(item.value))

		return { percentByName, formatPercent }
	}, [chartData])

	const { legendBoxWidth, legendLabelByName, legendAlign } = useMemo<{
		legendBoxWidth: number
		legendLabelByName: Map<string, string>
		legendAlign: 'left' | 'right' | undefined
	}>(() => {
		// Shrink legend width to its content when possible to avoid big empty columns.
		// When labels must be truncated, use the full available width and left-align so text stays close to the pie.
		if (!showLegend || isSmall)
			return {
				legendBoxWidth: 0,
				legendLabelByName: new Map(),
				legendAlign: undefined as 'left' | 'right' | undefined
			}
		const legendOrient = legendPosition?.orient ?? 'vertical'
		const legendIsRight = legendPosition?.right != null || legendPosition?.left === 'right' || !legendPosition
		if (legendOrient !== 'vertical' || !legendIsRight)
			return {
				legendBoxWidth: 0,
				legendLabelByName: new Map(),
				legendAlign: undefined as 'left' | 'right' | undefined
			}

		const fontSize = typeof legendTextStyle?.fontSize === 'number' ? legendTextStyle.fontSize : 12
		const fontFamilyRaw = legendTextStyle?.fontFamily
		const fontWeightRaw = legendTextStyle?.fontWeight
		const fontFamily = typeof fontFamilyRaw === 'string' ? fontFamilyRaw : 'sans-serif'
		const fontWeight = typeof fontWeightRaw === 'number' || typeof fontWeightRaw === 'string' ? fontWeightRaw : 400
		// Keep this small so we don't over-truncate names.
		const iconAndPaddingPx = 22
		const fallbackWidth = (text: string) => text.length * fontSize * 0.58
		const measureCtx =
			typeof document === 'undefined'
				? null
				: (() => {
						const canvas = document.createElement('canvas')
						return canvas.getContext('2d')
					})()
		if (measureCtx) {
			measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
		}

		const safeMeasure = (text: string) => {
			return measureCtx ? measureCtx.measureText(text).width : fallbackWidth(text)
		}

		const truncateToWidth = (text: string, maxWidthPx: number) => {
			if (maxWidthPx <= 0) return ''
			if (safeMeasure(text) <= maxWidthPx) return text
			const ell = '…'
			const ellW = safeMeasure(ell)
			if (ellW >= maxWidthPx) return ell

			let lo = 0
			let hi = text.length
			while (lo < hi) {
				const mid = Math.ceil((lo + hi) / 2)
				const candidate = text.slice(0, mid) + ell
				if (safeMeasure(candidate) <= maxWidthPx) lo = mid
				else hi = mid - 1
			}
			return text.slice(0, lo) + ell
		}

		// Determine legend box width.
		// - If `toRight` is provided, treat it as a MIN (caller intent),
		//   but allow growing up to a cap to reduce unnecessary ellipsis.
		// - If not provided, shrink-to-fit up to 200px.
		const minWidth = typeof toRight === 'number' ? toRight : 0
		const maxWidth = typeof toRight === 'number' ? Math.max(toRight, 420) : 200
		let maxTextW = 0
		for (const item of chartData) {
			const pct = percentByName.get(item.name) ?? '0%'
			const full = `${item.name} (${pct})`
			maxTextW = Math.max(maxTextW, safeMeasure(full))
		}
		const desired = Math.ceil(maxTextW + iconAndPaddingPx)
		const boxWidth = Math.max(80, Math.min(Math.max(desired, minWidth), maxWidth))
		const needsTruncation = desired > boxWidth

		const availableTextPx = Math.max(0, boxWidth - iconAndPaddingPx)
		const labelByName = new Map<string, string>()
		for (const item of chartData) {
			const name = String(item.name)
			const pct = percentByName.get(item.name) ?? '0%'
			const pctText = ` (${pct})`
			const pctW = safeMeasure(pctText)
			const maxNamePx = Math.max(0, availableTextPx - pctW)
			const finalName = truncateToWidth(name, maxNamePx)
			labelByName.set(item.name, `${finalName}${pctText}`)
		}

		return {
			legendBoxWidth: boxWidth,
			legendLabelByName: labelByName,
			legendAlign: needsTruncation ? 'left' : 'right'
		}
	}, [showLegend, isSmall, legendPosition, legendTextStyle, toRight, chartData, percentByName])

	// Space reserved for legend + some breathing room to the card border.
	const reservedRight = legendBoxWidth ? legendBoxWidth + 12 + 2 : 0

	const series = useMemo(() => {
		const series: PieSeriesOption = {
			name: '',
			type: 'pie',
			label: {
				fontFamily: 'sans-serif',
				color: chartTheme.text,
				formatter: (x) => {
					return `${x.name}: (${formatPercent(Number(x.value))})`
				},
				show: !showLegend
			},
			emphasis: {
				itemStyle: {
					shadowBlur: 10,
					shadowOffsetX: 0,
					shadowColor: 'rgba(0, 0, 0, 0.5)'
				}
			},
			data: chartData.map((item) => ({
				name: item.name,
				value: item.value,
				itemStyle: {
					color: stackColorByName.get(item.name)
				}
			}))
		}

		if (reservedRight > 0) {
			// Reserve pixels on the right for a potentially large legend so it
			// never overlaps the pie (ECharts legend is drawn inside the canvas).
			series.left = 0
			series.right = reservedRight
		}

		if (radius) {
			series.radius = radius
		} else {
			if (!isSmall) {
				// Slightly larger on desktop when a right-side legend exists,
				// so the pie uses the available canvas and reduces "wasted" left space.
				// Without a legend the external labels + leader lines render around
				// the arc — 70% left them colliding with the card edge (the pie is
				// centered at 50% with zero grid), so reserve the room in the radius.
				series.radius = reservedRight > 0 ? '78%' : '62%'
			}
		}

		if (customLabel && typeof customLabel === 'object') {
			series.label = { ...series.label, ...customLabel }
		}

		return series
	}, [chartTheme, showLegend, chartData, radius, stackColorByName, isSmall, reservedRight, formatPercent, customLabel])

	const isChartDisposed = (inst: echarts.ECharts | null) => {
		if (!inst) return true
		if (typeof inst.isDisposed !== 'function') {
			if (process.env.NODE_ENV === 'development') {
				console.warn('ECharts instance missing isDisposed method — treating as disposed')
			}
			return true
		}
		return inst.isDisposed()
	}

	useEffect(() => {
		const el = chartDomRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		handleChartReady(instance)
		emitReady(instance)

		return () => {
			persistentLifecycle.capture(instance)
			chartRef.current = null
			instance.dispose()
			handleChartReady(null)
			emitReady(null)
		}
	}, [handleChartReady, persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance || isChartDisposed(instance)) return

		const option: EChartsOption = {
			tooltip: {
				trigger: 'item',
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				confine: true,
				formatter: (params: unknown) => {
					const p = normalizePieTooltipParams(params)
					if (formatTooltip) return formatTooltip(p)
					const rawValue = typeof p?.value === 'number' ? p.value : Number(p?.value ?? 0)
					const formattedValue = formatTooltipValue(rawValue, valueSymbol)
					return `${p.marker ?? ''}${p.name ?? ''}: <b>${formattedValue}</b> (${p.percent ?? 0}%)`
				}
			},
			grid: {
				left: 0,
				outerBoundsMode: 'same',
				outerBoundsContain: 'axisLabel',
				bottom: 0,
				top: 0,
				right: 0
			},
			legend: {
				...chartLegendScrollStyle(chartTheme.legendPageActive, chartTheme.legendPageInactive, chartTheme.axisLabel),
				show: showLegend,
				type: 'scroll',
				top: CHART_INSET,
				right: CHART_VERTICAL_LEGEND_RIGHT_INSET,
				orient: 'vertical', // Default
				data: chartData.map((item) => item.name),
				icon: 'circle',
				itemWidth: 10,
				itemHeight: 10,
				itemGap: 10,
				// If everything fits, right-align looks cleaner. If truncated, left-align maximizes readable label length.
				align: legendAlign,
				textStyle: {
					color: chartTheme.text, // Default color
					...(legendTextStyle || {}) // Apply overrides from prop
				},
				formatter: function (name: string) {
					return legendLabelByName.get(String(name)) ?? String(name)
				},
				...(legendBoxWidth > 0 ? { width: legendBoxWidth } : {}),
				...legendPosition // Apply overrides from prop (left/right/top/bottom/orient)
			},
			series
		}
		instance.setOption(option)
	}, [
		series,
		chartTheme,
		valueSymbol,
		showLegend,
		chartData,
		legendPosition,
		legendTextStyle,
		formatTooltip,
		legendBoxWidth,
		legendLabelByName,
		legendAlign
	])

	const syncLayout = useStableCallback(() => {
		const instance = chartRef.current
		if (!instance || isChartDisposed(instance)) return
		const w = instance.getWidth()
		const h = instance.getHeight()
		const availableW = Math.max(1, w - reservedRight)
		const cx = Math.round(availableW / 2)
		const cy = Math.round((Number.parseFloat(centerY) / 100) * h)
		const minDim = Math.max(1, Math.min(h, w - reservedRight))
		let watermarkHeight = 40
		let watermarkWidth = Math.round(watermarkHeight * (389 / 133))
		const maxWidth = minDim * 0.6
		if (watermarkWidth > maxWidth) {
			const scale = maxWidth / watermarkWidth
			watermarkWidth = Math.round(watermarkWidth * scale)
			watermarkHeight = Math.max(20, Math.round(watermarkHeight * scale))
		}

		const option: EChartsOption = {
			series: {
				center: !showLegend || isSmall || reservedRight <= 0 ? ['50%', centerY] : [cx, centerY]
			},
			graphic: [
				{
					id: 'defillama-watermark',
					type: 'image',
					zlevel: 10,
					z: 999,
					silent: true,
					left: Math.round(cx - watermarkWidth / 2),
					top: Math.round(cy - watermarkHeight / 2),
					style: {
						image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
						width: watermarkWidth,
						height: watermarkHeight,
						opacity: 0.3
					}
				}
			]
		}
		instance.setOption(option, { lazyUpdate: true })
	})

	// The shared observer resizes the canvas and then recomputes this chart's pixel-positioned watermark.
	useChartResize(chartRef, chartDomRef, { onResize: syncLayout })

	useEffect(() => {
		syncLayout()
	}, [showLegend, isSmall, reservedRight, isDark, centerY, syncLayout])

	return (
		<ChartContainer
			chartRef={chartDomRef}
			chartClassName="mx-0 my-auto h-[360px]"
			chartStyle={height ? { height } : undefined}
			header={
				title || imageExportEnabled || csvDownloadEnabled ? (
					<ChartHeader
						title={title}
						headingAs={headingAs}
						exportButtons={
							<ChartExportButtons
								chartInstance={chartInstance}
								filename={exportFilename}
								title={exportTitle}
								iconUrl={exportButtonsConfig?.pngIconUrl}
								showCsv={csvDownloadEnabled}
								showPng={imageExportEnabled}
							/>
						}
					/>
				) : null
			}
			{...props}
		/>
	)
}

export default withEChartsRenderVisibility(PieChart)

import type {
	EChartsOption,
	LegendComponentOption,
	TooltipComponentOption,
	TooltipComponentPositionCallback,
	XAXisComponentOption
} from 'echarts'
import { BarChart, CustomChart, LineChart } from 'echarts/charts'
import {
	DatasetComponent,
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	MarkAreaComponent,
	MarkLineComponent,
	TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useContext, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { useCanvasWatermarkEnabled } from '~/components/ECharts/shared/watermark'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { prefersReducedMotion } from '~/hooks/usePrefersReducedMotion'
import { useStableCallback } from '~/hooks/useStableCallback'
import { slug } from '~/utils'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { ChartContainer } from '../shared/ChartContainer'
import { ChartHeader } from '../shared/ChartHeader'
import { joinChartHoverSync } from '../shared/chartHoverSync'
import { setChartLogoMetadata } from '../shared/chartLogoMetadata'
import { ChartMotionContext, enterAnimationOptions } from '../shared/chartMotion'
import {
	CHART_REFERENCE_LABEL_RESERVE,
	CHART_INSET,
	CHART_LEGEND_RESERVE,
	chartGrid,
	chartHorizontalScrollLegend,
	chartLegendScrollStyle
} from '../shared/chartSpacing'
import { resolveChartColor, useChartTheme } from '../shared/chartTheme'
import { useLoadedIconUrls } from '../shared/icon'
import { mergeDeep } from '../shared/merge'
import { normalizeTooltipItems } from '../shared/tooltip'
import {
	buildDefaultChartSettings,
	getViewportTooltipPosition,
	inferMultiSeriesCharts,
	mergeChartOptions,
	remapLogEligibleYAxes,
	withChartGroupBy
} from './chartOptions'
import { prepareMultiSeriesDataset } from './datasetAdapter'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	createEventStripYAxis,
	type EventHoverState,
	getDatasetTimeBounds,
	getMainGridBottom,
	getSeriesTimeBounds
} from './eventRail'
import { applyConfiguredYAxisScale, applyLogScaleToYAxes } from './logScale'
import { buildMultiYAxis, normalizeSeriesYAxisIndices } from './multiYAxis'
import { buildReferenceMarkLine } from './referenceLines'
import { selectChartDatasetColumns } from './selection'
import { buildMultiSeries, getPointerLines, getPointerStack } from './series'
import { assignStackColors } from './stackColors'
import { createStateTimelineSeries, getStateTimelineGridBottom } from './stateTimeline'
import { buildSparseTimeSeriesDataset } from './timeSeriesDataset'
import { createTooltipFormatter, findNearestLineSeries, findPointedStackSeries } from './tooltip'
import type { IMultiSeriesChartProps } from './types'

echarts.use([
	CanvasRenderer,
	LineChart,
	BarChart,
	CustomChart,
	TooltipComponent,
	GridComponent,
	DataZoomComponent,
	GraphicComponent,
	MarkAreaComponent,
	MarkLineComponent,
	LegendComponent,
	DatasetComponent
])

function isChartDisposed(instance: echarts.ECharts) {
	return instance.isDisposed()
}

type GroupBy = NonNullable<IMultiSeriesChartProps['groupBy']>

const CATEGORY_LOGO_SIZE = 22
const CATEGORY_LOGO_BOTTOM_GAP = 10
const EMPTY_CHART_OPTIONS: NonNullable<IMultiSeriesChartProps['chartOptions']> = {}

function MultiSeriesChart(props: IMultiSeriesChartProps) {
	const {
		charts,
		chartOptions = EMPTY_CHART_OPTIONS,
		height,
		hallmarks,
		rangeHallmarks,
		referenceLines,
		stateTimeline,
		expandTo100Percent,
		valueSymbol = '$',
		tooltipMaxItems,
		groupBy,
		alwaysShowTooltip,
		stacked = false,
		solidChartAreaStyle = false,
		hideDataZoom,
		showTotalInTooltip = false,
		requireCompleteTooltipTotal = false,
		onReady,
		showLegend = false,
		selectedCharts,
		dataset,
		csvSource,
		exportButtons,
		title,
		subtitle,
		titleTooltip,
		headingAs,
		containerClassName,
		categoryLogos,
		isThemeDark: isThemeDarkOverride,
		syncGroup
	} = props

	const canvasWatermarkEnabled = useCanvasWatermarkEnabled()
	const [managedIsThemeDark] = useDarkModeManager()
	const isThemeDark = isThemeDarkOverride ?? managedIsThemeDark
	// Legend icons render only once their image URL has been probed, so the probe result is series input.
	const chartTheme = useChartTheme(isThemeDark)
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const chartDomRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const categoryLogosOverlayRef = useRef<HTMLDivElement>(null)
	const hasCategoryLogos = !!(categoryLogos && categoryLogos.some(Boolean))
	const eventHoverCleanupRef = useRef<(() => void) | null>(null)
	const eventHoverStateRef = useRef<EventHoverState>({ hoveredEventDate: null })
	const categoryLogosFrameRef = useRef<number | null>(null)
	const categoryLogosLayoutRef = useRef<{
		categoryValues: Array<string | number | null | undefined>
		categoryLogos: Array<string>
		gridBottom: number
		logoBg: string
	} | null>(null)
	const latestTooltipDataIndexRef = useRef<number | null>(null)
	// The pointer's pixel y over the chart, so the tooltip can name the stack band under it.
	const pointerYRef = useRef<number | null>(null)
	const chartMotion = useContext(ChartMotionContext)
	// Per-component tooltip size cache (used by tooltip.position). Keeping this in a ref avoids
	// recreating it on effect re-runs and prevents cross-chart interference.
	const tooltipSizeCacheRef = useRef<{ w: number; h: number; updatedAt: number } | null>(null)
	// The end-label formatter needs the live instance, but echarts calls it while painting, never during
	// render. A stable getter keeps the ref itself out of the series build below.
	const getChart = useStableCallback(() => chartRef.current)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const { hasEnteredRef } = persistentLifecycle

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, chartDomRef)

	const groupBySafe: GroupBy = groupBy ?? 'daily'

	const defaultChartSettings = useMemo(
		() => buildDefaultChartSettings({ chartTheme, canvasWatermarkEnabled, isThemeDark, isSmall, valueSymbol }),
		[canvasWatermarkEnabled, chartTheme, isThemeDark, valueSymbol, isSmall]
	)

	const datasetDimensions = dataset.dimensions
	const inferredCharts = useMemo(() => inferMultiSeriesCharts(datasetDimensions, stacked), [datasetDimensions, stacked])
	const effectiveCharts = useMemo(() => {
		const source = charts && charts.length > 0 ? charts : inferredCharts
		return source.map((chart) =>
			chart.color ? { ...chart, color: resolveChartColor(chart.color, chartTheme) } : chart
		)
	}, [charts, inferredCharts, chartTheme])
	const legendIconUrls: Array<string> = []
	for (const chart of effectiveCharts) {
		if (chart.legendIconUrl) legendIconUrls.push(chart.legendIconUrl)
	}
	const validLegendIcons = useLoadedIconUrls(legendIconUrls)
	const displayedCharts = useMemo(
		() => (selectedCharts ? effectiveCharts.filter((chart) => selectedCharts.has(chart.name)) : effectiveCharts),
		[effectiveCharts, selectedCharts]
	)
	const preparedDataset = useMemo(() => prepareMultiSeriesDataset(dataset, effectiveCharts), [dataset, effectiveCharts])
	const renderedDatasetDimensions = preparedDataset.logicalDimensions
	const echartsDatasetDimensions = preparedDataset.dimensions
	const renderedDatasetSource = preparedDataset.source
	const renderedCharts = preparedDataset.charts
	const displayedRenderedCharts = useMemo(
		() => (selectedCharts ? renderedCharts.filter((chart) => selectedCharts.has(chart.name)) : renderedCharts),
		[renderedCharts, selectedCharts]
	)
	const directSeriesStats = useMemo(() => {
		let pointCount = 0
		let min: number | undefined
		let max: number | undefined
		for (const chart of displayedRenderedCharts) {
			if (!chart.data) continue
			if (chart.data.length > pointCount) pointCount = chart.data.length
			const bounds = getSeriesTimeBounds(chart.data)
			if (bounds.min != null && (min == null || bounds.min < min)) min = bounds.min
			if (bounds.max != null && (max == null || bounds.max > max)) max = bounds.max
		}
		return { pointCount, min, max }
	}, [displayedRenderedCharts])

	const mergedChartSettings = useMemo(
		() => mergeChartOptions(defaultChartSettings, chartOptions),
		[defaultChartSettings, chartOptions]
	)

	// Default exports ON for charts with at least one series unless explicitly disabled by the caller.
	// (Historically this was limited to line charts, which made `exportButtons="auto"` appear "broken"
	// on bar-chart pages like Raises.)
	const hasAnySeries = displayedCharts.length > 0
	// If a caller provides `onReady`, they often manage export instances + buttons outside the chart,
	// so avoid showing duplicate toolbars by default in that case (auto mode).
	const autoExportsEnabled = !onReady && hasAnySeries

	const exportButtonsMode = exportButtons ?? 'auto'
	const exportButtonsConfig =
		typeof exportButtonsMode === 'object' && exportButtonsMode !== null ? exportButtonsMode : undefined
	const exportButtonsHidden = exportButtonsMode === 'hidden'
	const exportButtonsAuto = exportButtonsMode === 'auto'

	const shouldEnableImageExport = exportButtonsHidden
		? false
		: exportButtonsConfig
			? (exportButtonsConfig.png ?? true)
			: exportButtonsAuto
				? autoExportsEnabled
				: false

	const shouldEnableCSVDownload = exportButtonsHidden
		? false
		: exportButtonsConfig
			? (exportButtonsConfig.csv ?? true)
			: exportButtonsAuto
				? autoExportsEnabled
				: false

	const referenceMarkLine = useMemo(
		() =>
			referenceLines?.length
				? buildReferenceMarkLine({ lines: referenceLines, textColor: chartTheme.text })
				: undefined,
		[referenceLines, chartTheme.text]
	)

	const pointerStack = useMemo(
		() => getPointerStack(renderedCharts, selectedCharts, expandTo100Percent),
		[renderedCharts, selectedCharts, expandTo100Percent]
	)
	// Computed once per dataset and pick, never on hover.
	const coloredCharts = useMemo(() => {
		const colors =
			pointerStack &&
			assignStackColors({ charts: renderedCharts, stack: pointerStack.series, source: renderedDatasetSource })
		if (!colors) return renderedCharts
		return renderedCharts.map((chart) => {
			const color = colors.get(chart.name)
			return color ? { ...chart, color } : chart
		})
	}, [pointerStack, renderedCharts, renderedDatasetSource])

	const { series, sourceAxisIndexes } = useMemo(() => {
		const builtSeries = buildMultiSeries({
			charts: coloredCharts,
			selectedCharts,
			expandTo100Percent,
			solidChartAreaStyle,
			chartTheme,
			referenceMarkLine,
			getChart,
			validLegendIcons
		})
		return normalizeSeriesYAxisIndices(builtSeries)
	}, [
		coloredCharts,
		chartTheme,
		expandTo100Percent,
		solidChartAreaStyle,
		selectedCharts,
		referenceMarkLine,
		getChart,
		validLegendIcons
	])
	const displayValueSymbol = expandTo100Percent ? '%' : valueSymbol

	const eventRailData = useMemo(
		() => buildEventRailData({ hallmarks, rangeHallmarks, isThemeDark }).events,
		[hallmarks, rangeHallmarks, isThemeDark]
	)

	const { seriesSymbols, tooltipTotalExcludedSeries } = useMemo(() => {
		let seriesSymbols: Map<string, string> | undefined
		let tooltipTotalExcludedSeries: Set<string> | undefined
		for (const chart of displayedCharts) {
			if (chart.valueSymbol != null) {
				seriesSymbols = seriesSymbols ?? new Map<string, string>()
				seriesSymbols.set(chart.name, chart.valueSymbol)
			}
			if (chart.excludeFromTooltipTotal) {
				tooltipTotalExcludedSeries = tooltipTotalExcludedSeries ?? new Set<string>()
				tooltipTotalExcludedSeries.add(chart.name)
			}
		}
		return { seriesSymbols, tooltipTotalExcludedSeries }
	}, [displayedCharts])

	const finalYAxis = useMemo(
		() =>
			buildMultiYAxis({
				series,
				yAxis: applyConfiguredYAxisScale(mergedChartSettings.yAxis, chartOptions.yAxis),
				configuredYAxis: chartOptions.yAxis,
				expandTo100Percent,
				effectiveCharts: displayedCharts,
				valueSymbol: displayValueSymbol,
				sourceAxisIndexes
			}),
		[
			series,
			mergedChartSettings.yAxis,
			chartOptions.yAxis,
			expandTo100Percent,
			displayedCharts,
			displayValueSymbol,
			sourceAxisIndexes
		]
	)
	const logEligibleYAxes = useMemo(
		() => remapLogEligibleYAxes(props.logEligibleYAxes, sourceAxisIndexes),
		[props.logEligibleYAxes, sourceAxisIndexes]
	)
	const finalYAxisBase = useMemo(() => {
		const yAxis = mergedChartSettings.yAxis
		const primaryYAxis = Array.isArray(yAxis) ? (yAxis[0] ?? {}) : yAxis
		return applyLogScaleToYAxes(
			finalYAxis && finalYAxis.length > 0
				? finalYAxis
				: [
						{
							...primaryYAxis,
							...(expandTo100Percent ? { max: 100, min: 0 } : {})
						}
					],
			props.logScale,
			logEligibleYAxes
		)
	}, [finalYAxis, mergedChartSettings.yAxis, expandTo100Percent, props.logScale, logEligibleYAxes])

	const pointerLines = useMemo(() => (pointerStack ? null : getPointerLines(series)), [pointerStack, series])
	// Flags the series under the pointer (a stack band, or the nearest of several lines) on the tooltip items, so
	// whichever formatter the chart uses can lead with it.
	const markPointedSeries = useStableCallback((params: unknown) => {
		const instance = chartRef.current
		const pointerY = pointerYRef.current
		if (!instance || instance.isDisposed() || pointerY == null) return
		const items = normalizeTooltipItems(params)
		let pointed: string | null = null
		if (pointerStack) {
			const yAxisIndex = sourceAxisIndexes
				? sourceAxisIndexes.indexOf(pointerStack.yAxisIndex)
				: pointerStack.yAxisIndex
			pointed = findPointedStackSeries(items, pointerStack.series, instance.convertFromPixel({ yAxisIndex }, pointerY))
		} else if (pointerLines) {
			pointed = findNearestLineSeries(
				items,
				pointerLines,
				(yAxisIndex, value) => instance.convertToPixel({ yAxisIndex }, value),
				pointerY
			)
		}
		for (const item of items) if (item.seriesName === pointed) item.pointed = true
	})
	const tooltipFormatter = useMemo(
		() =>
			createTooltipFormatter({
				groupBy: groupBySafe,
				valueSymbol: displayValueSymbol,
				seriesSymbols,
				tooltipTotalExcludedSeries,
				maxItems: tooltipMaxItems,
				showTotalInTooltip,
				requireCompleteTooltipTotal
			}),
		[
			groupBySafe,
			displayValueSymbol,
			seriesSymbols,
			tooltipTotalExcludedSeries,
			tooltipMaxItems,
			showTotalInTooltip,
			requireCompleteTooltipTotal
		]
	)

	const exportFilename = exportButtonsConfig?.filename || (title ? slug(title) : 'multi-series-chart')
	const exportTitle = exportButtonsConfig?.pngTitle || title
	// Without a `csvSource` the export follows the picker: only the series `selectedCharts` shows.
	const defaultCsvSource = useMemo(() => {
		if (!renderedCharts.some((chart) => chart.data)) {
			return {
				type: 'dataset' as const,
				prepare: () => ({
					...(selectedCharts ? selectChartDatasetColumns(dataset, displayedCharts) : dataset),
					groupBy: groupBySafe
				})
			}
		}
		return {
			type: 'dataset' as const,
			prepare: () => {
				const independentSeries: Array<{
					name: string
					data: Array<[timestamp: number, value: number | null]>
				}> = []
				for (const chart of displayedRenderedCharts) {
					if (chart.data) {
						independentSeries.push({ name: chart.name, data: chart.data })
						continue
					}
					const xIndex = typeof chart.encode.x === 'number' ? chart.encode.x : -1
					const yIndex = typeof chart.encode.y === 'number' ? chart.encode.y : -1
					const data: Array<[number, number | null]> = []
					for (const row of renderedDatasetSource) {
						const timestamp = row[xIndex]
						const value = row[yIndex]
						if (typeof timestamp !== 'number') continue
						if (typeof value === 'number') data.push([timestamp, value])
						else if (value === null) data.push([timestamp, null])
					}
					independentSeries.push({ name: chart.name, data })
				}
				return { ...buildSparseTimeSeriesDataset(independentSeries), groupBy: groupBySafe }
			}
		}
	}, [
		dataset,
		displayedCharts,
		displayedRenderedCharts,
		renderedCharts,
		renderedDatasetSource,
		groupBySafe,
		selectedCharts
	])
	const exportCsvSource = useMemo<ChartCsvSource>(
		() => (csvSource ? withChartGroupBy(csvSource, groupBySafe) : defaultCsvSource),
		[csvSource, defaultCsvSource, groupBySafe]
	)
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})
	const syncCategoryLogos = useStableCallback(() => {
		const layer = categoryLogosOverlayRef.current
		const instance = chartRef.current
		const layout = categoryLogosLayoutRef.current
		if (!layer) return
		layer.innerHTML = ''
		if (!layout || !instance || instance.isDisposed()) return

		const chartHeight = instance.getHeight()
		if (!Number.isFinite(chartHeight)) return
		const centerY = chartHeight - layout.gridBottom + CATEGORY_LOGO_BOTTOM_GAP / 2 + CATEGORY_LOGO_SIZE / 2
		for (let i = 0; i < layout.categoryValues.length; i++) {
			const url = layout.categoryLogos[i]
			if (!url) continue
			const categoryValue = layout.categoryValues[i]
			if (categoryValue == null) continue
			const x = instance.convertToPixel({ xAxisIndex: 0 }, categoryValue)
			if (!Number.isFinite(x)) continue
			const img = document.createElement('img')
			img.src = url
			img.alt = ''
			img.loading = 'lazy'
			img.decoding = 'async'
			img.title = String(categoryValue)
			img.style.cssText = `position:absolute;left:${x - CATEGORY_LOGO_SIZE / 2}px;top:${centerY - CATEGORY_LOGO_SIZE / 2}px;width:${CATEGORY_LOGO_SIZE}px;height:${CATEGORY_LOGO_SIZE}px;border-radius:50%;object-fit:cover;background:${layout.logoBg};pointer-events:none;`
			img.addEventListener('error', () => img.remove(), { once: true })
			layer.appendChild(img)
		}
	})
	const trackPointer = useStableCallback((event: { offsetY: number }) => {
		pointerYRef.current = event.offsetY
	})
	const showLatestTooltip = useStableCallback(() => {
		// The resting tooltip points at no band.
		pointerYRef.current = null
		const instance = chartRef.current
		const dataIndex = latestTooltipDataIndexRef.current
		if (!instance || instance.isDisposed() || dataIndex == null) return
		instance.dispatchAction({
			type: 'showTip',
			seriesIndex: 0,
			dataIndex,
			position: [60, 0]
		})
	})
	useEffect(() => {
		const el = chartDomRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		emitReady(instance)
		instance.on('finished', syncCategoryLogos)
		instance.on('globalout', showLatestTooltip)
		// Registered before setOption, so it runs ahead of the tooltip's own pointer handler.
		instance.getZr().on('mousemove', trackPointer)

		return () => {
			persistentLifecycle.capture(instance)
			instance.off('finished', syncCategoryLogos)
			instance.off('globalout', showLatestTooltip)
			instance.getZr().off('mousemove', trackPointer)
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
			if (categoryLogosFrameRef.current != null) {
				cancelAnimationFrame(categoryLogosFrameRef.current)
				categoryLogosFrameRef.current = null
			}
			setChartLogoMetadata(instance, undefined)
			chartRef.current = null
			categoryLogosLayoutRef.current = null
			latestTooltipDataIndexRef.current = null
			tooltipSizeCacheRef.current = null
			instance.dispose()
			emitReady(null)
		}
	}, [persistentLifecycle, showLatestTooltip, syncCategoryLogos, trackPointer])

	useEffect(() => {
		const instance = chartRef.current
		const el = chartDomRef.current
		if (!instance || !el || !syncGroup) return
		return joinChartHoverSync(syncGroup, instance, el)
	}, [syncGroup])

	useEffect(() => {
		const instance = chartRef.current
		const el = chartDomRef.current
		if (!instance || !el) return

		const {
			legend,
			graphic,
			xAxis,
			yAxis: _configuredYAxis,
			grid: _configuredGrid,
			tooltip: _configuredTooltip,
			dataZoom,
			useUTC
		} = mergedChartSettings

		const datasetLength = Math.max(renderedDatasetSource.length, directSeriesStats.pointCount)
		const shouldHideDataZoom = hideDataZoom || datasetLength < 2
		const shouldShowEventRail = eventRailData.length > 0
		const shouldShowStateTimeline = !shouldShowEventRail && (stateTimeline?.points.length ?? 0) > 0
		const gridBottom = shouldShowStateTimeline
			? getStateTimelineGridBottom(shouldHideDataZoom)
			: getMainGridBottom({ shouldShowEventRail, shouldHideDataZoom })
		// Both strips sit on one hidden y-axis and reserve the same x-range handling.
		const shouldShowStrip = shouldShowEventRail || shouldShowStateTimeline

		// Always use a scroll legend when the default legend is enabled. ECharts
		// decides whether paging is needed; asymmetric padding supplies the left
		// clip inset without forcing short legends away from right alignment.
		const legendScrollStyle = chartLegendScrollStyle(
			chartTheme.legendPageActive,
			chartTheme.legendPageInactive,
			chartTheme.axisLabel
		)
		const getScrollLegend = (legendOption: LegendComponentOption) =>
			chartHorizontalScrollLegend(legendOption, legendScrollStyle)
		const finalLegend = !showLegend
			? undefined
			: Array.isArray(legend)
				? legend.map(getScrollLegend)
				: legend
					? getScrollLegend(legend)
					: undefined

		const datasetForOption = {
			source: renderedDatasetSource,
			dimensions: echartsDatasetDimensions
		}

		const clampTooltipToViewport: TooltipComponentPositionCallback = (point, params, dom, _rect, size) => {
			const containerRect = el.getBoundingClientRect()

			const px = Array.isArray(point) ? Number(point[0]) : Number.NaN
			const py = Array.isArray(point) ? Number(point[1]) : Number.NaN

			const [tw, th] = Array.isArray(size?.contentSize) ? size.contentSize : [0, 0]
			let tooltipW = Number(tw) || 0
			let tooltipH = Number(th) || 0

			const rows = Array.isArray(params) ? params.length : 1

			if (tooltipW > 0 && tooltipH > 0) {
				tooltipSizeCacheRef.current = { w: tooltipW, h: tooltipH, updatedAt: Date.now() }
			} else if (tooltipSizeCacheRef.current && Date.now() - tooltipSizeCacheRef.current.updatedAt < 10_000) {
				// Reuse cached size for a short window (e.g. during hover), no layout read.
				tooltipW = tooltipSizeCacheRef.current.w
				tooltipH = tooltipSizeCacheRef.current.h
			} else if (rows > 20 && dom instanceof HTMLElement) {
				// Large tooltips benefit from accurate size; measure once if needed.
				const domRect = dom.getBoundingClientRect()
				tooltipW = Number(domRect?.width) || tooltipW
				tooltipH = Number(domRect?.height) || tooltipH
				if (tooltipW > 0 && tooltipH > 0) {
					tooltipSizeCacheRef.current = { w: tooltipW, h: tooltipH, updatedAt: Date.now() }
				}
			} else {
				// Small tooltips: avoid any DOM measurement. Over-estimate so clamping is safe.
				tooltipW = 420
				tooltipH = Math.min(300, 44 + rows * 18)
			}

			// Clamp against the layout viewport (excludes scrollbar width).
			const vw = document.documentElement?.clientWidth || window.innerWidth
			const vh = document.documentElement?.clientHeight || window.innerHeight

			return getViewportTooltipPosition({
				point: [Number.isFinite(px) ? px : 0, Number.isFinite(py) ? py : 0],
				tooltipSize: [tooltipW, tooltipH],
				containerRect,
				viewport: [vw, vh]
			})
		}

		const baseTooltip = mergedChartSettings.tooltip ?? {}
		const tooltipOverride = Array.isArray(chartOptions?.tooltip) ? chartOptions.tooltip[0] : chartOptions?.tooltip
		const customTooltipFormatter = tooltipOverride?.formatter
		const formatter = customTooltipFormatter ?? tooltipFormatter
		const pointedFormatter: TooltipComponentOption['formatter'] =
			typeof formatter === 'function'
				? (params, ticket, callback) => {
						markPointedSeries(params)
						return formatter(params, ticket, callback)
					}
				: formatter
		const enterable = typeof baseTooltip?.enterable === 'boolean' ? baseTooltip.enterable : false
		const baseExtraCssText = typeof baseTooltip?.extraCssText === 'string' ? baseTooltip.extraCssText : ''
		const extraCssText = [
			baseExtraCssText,
			'z-index: 2147483647',
			'box-sizing: border-box',
			'max-height: calc(100vh - 24px)',
			'max-width: calc(100vw - 24px)',
			'overflow-y: auto',
			'overflow-x: hidden',
			'white-space: normal',
			'word-break: break-word',
			// Keep hover tracking smooth (tooltip should never intercept pointer events)
			...(enterable ? [] : ['pointer-events: none'])
		]
			.filter(Boolean)
			.join('; ')

		const tooltipConfig: TooltipComponentOption = {
			...baseTooltip,
			renderMode: 'html',
			enterable,
			// Clamp to the browser viewport (not the chart grid).
			confine: false,
			position: clampTooltipToViewport,
			extraCssText,
			trigger: 'axis',
			formatter: pointedFormatter
		}
		delete tooltipConfig.appendToBody
		delete tooltipConfig.className
		if (!alwaysShowTooltip) {
			tooltipConfig.appendToBody = true
			tooltipConfig.className = 'defillama-echarts-tooltip'
			tooltipConfig.backgroundColor = 'transparent'
			tooltipConfig.borderWidth = 0
		}

		const baseGrid = chartGrid({
			bottom: gridBottom,
			top: Math.max(
				showLegend ? CHART_LEGEND_RESERVE : CHART_INSET,
				referenceMarkLine ? CHART_INSET + CHART_REFERENCE_LABEL_RESERVE : 0
			)
		})
		const finalGrid = mergedChartSettings.grid ? mergeDeep(baseGrid, mergedChartSettings.grid) : baseGrid
		const hasExplicitGridBottom = mergedChartSettings.grid?.bottom != null
		if (!hasExplicitGridBottom) {
			finalGrid.bottom = gridBottom
		}
		if (hasCategoryLogos) {
			finalGrid.bottom = Number(finalGrid.bottom ?? 12) + CATEGORY_LOGO_SIZE + CATEGORY_LOGO_BOTTOM_GAP
			finalGrid.outerBoundsContain = undefined
		}

		const timestampIndex = renderedDatasetDimensions.indexOf('timestamp')
		const datasetTimeBounds = shouldShowStrip
			? getDatasetTimeBounds(renderedDatasetSource, timestampIndex)
			: { min: undefined, max: undefined }
		const timeRangeMin =
			datasetTimeBounds.min == null
				? directSeriesStats.min
				: directSeriesStats.min == null
					? datasetTimeBounds.min
					: Math.min(datasetTimeBounds.min, directSeriesStats.min)
		const timeRangeMax =
			datasetTimeBounds.max == null
				? directSeriesStats.max
				: directSeriesStats.max == null
					? datasetTimeBounds.max
					: Math.max(datasetTimeBounds.max, directSeriesStats.max)
		const hasTimeRange =
			typeof timeRangeMin === 'number' &&
			Number.isFinite(timeRangeMin) &&
			typeof timeRangeMax === 'number' &&
			Number.isFinite(timeRangeMax) &&
			timeRangeMin < timeRangeMax

		let finalXAxis: XAXisComponentOption | undefined = shouldShowStrip
			? {
					...xAxis,
					// The strip's hidden y-axis spans -1..1. By default the x-axis line sits on the first
					// y-axis containing zero, which is that strip whenever the primary axis excludes zero:
					// a line through the middle of the plot. Pin the check to the primary axis instead.
					axisLine: { ...xAxis.axisLine, onZeroAxisIndex: 0 },
					...(hasTimeRange ? { min: timeRangeMin, max: timeRangeMax } : {})
				}
			: xAxis
		if (hasCategoryLogos) {
			finalXAxis = mergeDeep(finalXAxis ?? {}, { axisLabel: { show: false }, axisTick: { show: false } })
		}
		const eventStripYAxisIndex = finalYAxisBase.length
		const finalYAxisWithEvents = shouldShowStrip ? [...finalYAxisBase, createEventStripYAxis()] : finalYAxisBase
		// Same reference when no strip is drawn, so unchanged inputs do not re-set ECharts.
		const finalSeries = shouldShowEventRail
			? [
					...series,
					createEventRailSeries({
						eventRailData,
						eventStripYAxisIndex,
						hoverState: eventHoverStateRef.current,
						shouldHideDataZoom,
						isThemeDark
					})
				]
			: shouldShowStateTimeline && stateTimeline
				? [
						...series,
						createStateTimelineSeries({ timeline: stateTimeline, yAxisIndex: eventStripYAxisIndex, shouldHideDataZoom })
					]
				: series

		const hasRenderableSeries = finalSeries.length > 0 && datasetLength > 0
		const option: EChartsOption = {
			tooltip: tooltipConfig,
			grid: finalGrid,
			yAxis: finalYAxisWithEvents,
			series: finalSeries,
			dataset: datasetForOption,
			...enterAnimationOptions(chartMotion, hasEnteredRef.current || !hasRenderableSeries, prefersReducedMotion())
		}
		const renderedLegend = finalLegend ?? legend
		if (showLegend && renderedLegend !== undefined) option.legend = renderedLegend
		if (graphic !== undefined) option.graphic = graphic
		if (finalXAxis !== undefined) option.xAxis = finalXAxis
		// Time axes default to UTC so ticks agree with the UTC tooltip and zoom labels; only an explicit
		// `false` opts a chart into local time.
		option.useUTC = useUTC ?? true
		if (!shouldHideDataZoom && dataZoom !== undefined) option.dataZoom = dataZoom
		instance.setOption(option, { notMerge: true })
		if (hasRenderableSeries) hasEnteredRef.current = true

		if (hasCategoryLogos) {
			const categoryValues = renderedDatasetSource.map((row) => row[0])
			setChartLogoMetadata(instance, {
				kind: 'cartesian-x',
				logos: categoryLogos!,
				categoryValues
			})
			categoryLogosLayoutRef.current = {
				categoryValues,
				categoryLogos: categoryLogos!,
				gridBottom: Number(finalGrid.bottom),
				logoBg: chartTheme.logoBg
			}
		} else {
			setChartLogoMetadata(instance, undefined)
			categoryLogosLayoutRef.current = null
		}
		if (categoryLogosFrameRef.current != null) cancelAnimationFrame(categoryLogosFrameRef.current)
		categoryLogosFrameRef.current = hasCategoryLogos
			? requestAnimationFrame(() => {
					categoryLogosFrameRef.current = null
					syncCategoryLogos()
				})
			: null

		const firstSeriesDataLength = Array.isArray(series[0]?.data) ? series[0].data.length : renderedDatasetSource.length
		if (alwaysShowTooltip && firstSeriesDataLength > 0) {
			latestTooltipDataIndexRef.current = firstSeriesDataLength - 1
			showLatestTooltip()
		} else {
			latestTooltipDataIndexRef.current = null
			if (!isChartDisposed(instance)) {
				instance.dispatchAction({ type: 'hideTip' })
			}
		}
	}, [
		mergedChartSettings,
		series,
		chartOptions,
		alwaysShowTooltip,
		hideDataZoom,
		showLegend,
		referenceMarkLine,
		renderedDatasetSource,
		renderedDatasetDimensions,
		directSeriesStats,
		echartsDatasetDimensions,
		tooltipFormatter,
		eventRailData,
		stateTimeline,
		isThemeDark,
		chartTheme,
		finalYAxisBase,
		categoryLogos,
		hasCategoryLogos,
		showLatestTooltip,
		syncCategoryLogos,
		markPointedSeries,
		chartMotion,
		hasEnteredRef
	])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		eventHoverCleanupRef.current?.()
		eventHoverStateRef.current.hoveredEventDate = null
		eventHoverCleanupRef.current = attachEventHoverHandlers({
			instance,
			eventRailData,
			hoverState: eventHoverStateRef.current
		})

		return () => {
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
		}
	}, [eventRailData])

	return (
		<ChartContainer
			chartRef={chartDomRef}
			className={containerClassName ? 'flex flex-1 flex-col' : undefined}
			chartClassName={containerClassName ?? 'h-[360px]'}
			chartStyle={!containerClassName && height ? { height } : undefined}
			overlay={
				hasCategoryLogos ? (
					<div ref={categoryLogosOverlayRef} className="pointer-events-none absolute inset-0" aria-hidden />
				) : null
			}
			header={
				title || shouldEnableCSVDownload || shouldEnableImageExport ? (
					<ChartHeader
						title={title}
						subtitle={subtitle}
						titleTooltip={titleTooltip}
						headingAs={headingAs}
						exportButtons={
							<ChartExportButtons
								chartInstance={getChart}
								filename={exportFilename}
								title={exportTitle}
								iconUrl={exportButtonsConfig?.pngIconUrl}
								showCsv={shouldEnableCSVDownload}
								showPng={shouldEnableImageExport}
								csvSource={exportCsvSource}
							/>
						}
					/>
				) : null
			}
		/>
	)
}

export default withEChartsRenderVisibility(MultiSeriesChart)

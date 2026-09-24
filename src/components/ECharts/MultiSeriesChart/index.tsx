import type {
	DataZoomComponentOption,
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
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { useCanvasWatermarkEnabled } from '~/components/ECharts/shared/watermark'
import { CHART_COLORS } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useMedia } from '~/hooks/useMedia'
import { prefersReducedMotion } from '~/hooks/usePrefersReducedMotion'
import { useStableCallback } from '~/hooks/useStableCallback'
import { slug } from '~/utils'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import { ChartContainer } from '../shared/ChartContainer'
import { ChartHeader } from '../shared/ChartHeader'
import { joinChartHoverSync } from '../shared/chartHoverSync'
import { setChartLogoMetadata } from '../shared/chartLogoMetadata'
import { enterAnimationOptions, useChartMotion } from '../shared/chartMotion'
import {
	CHART_HALLMARK_LABEL_RESERVE,
	CHART_INSET,
	CHART_LEGEND_RESERVE,
	chartDataZoomSliderGeometry,
	chartGrid,
	chartHorizontalScrollLegend,
	chartLegendScrollStyle
} from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { formatChartEmphasisDate } from '../shared/formatters'
import { validateIconUrl } from '../shared/icon'
import { mergeDeep } from '../shared/merge'
import { prepareMultiSeriesDataset } from './datasetAdapter'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	createEventStripYAxis,
	type EventHoverState,
	getDatasetTimeBounds,
	getMainGridBottom,
	getSeriesTimeBounds,
	mergeGraphicWithEventMarkLinePlaceholder
} from './eventRail'
import { buildHallmarksMarkLine } from './hallmarks'
import { applyConfiguredYAxisScale, applyLogScaleToYAxes, getZeroBaselineYAxisMin, mergeYAxisOption } from './logScale'
import { buildMultiYAxis, formatAxisLabel, normalizeSeriesYAxisIndices } from './multiYAxis'
import { buildMultiSeries } from './series'
import { createStateTimelineSeries, getStateTimelineGridBottom } from './stateTimeline'
import { buildSparseTimeSeriesDataset } from './timeSeriesDataset'
import { createTooltipFormatter } from './tooltip'
import type { IMultiSeriesChartProps, MultiSeriesChartOptions, MultiSeriesYAxisOption } from './types'

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
const OFFSCREEN_TOOLTIP_POSITION: [number, number] = [-100_000, -100_000]
const CATEGORY_LOGO_BOTTOM_GAP = 10
const EMPTY_CHART_OPTIONS: NonNullable<IMultiSeriesChartProps['chartOptions']> = {}

type ResolvedMultiSeriesChartOptions = Omit<MultiSeriesChartOptions, 'yAxis'> & {
	yAxis?: MultiSeriesYAxisOption | Array<MultiSeriesYAxisOption>
}

function mergeOption<T>(base: T | undefined, override: T): T {
	return base === undefined ? override : mergeDeep(base, override)
}

function mergeChartOptions(
	defaults: ResolvedMultiSeriesChartOptions,
	overrides: MultiSeriesChartOptions
): ResolvedMultiSeriesChartOptions {
	const merged: ResolvedMultiSeriesChartOptions = { ...defaults }

	if (Object.hasOwn(overrides, 'dataZoom')) {
		const override = overrides.dataZoom
		if (override === undefined) delete merged.dataZoom
		else if (Array.isArray(defaults.dataZoom)) {
			merged.dataZoom = defaults.dataZoom.map((zoomOption, index) =>
				mergeDeep(zoomOption, Array.isArray(override) ? (override[index] ?? {}) : override)
			)
		} else merged.dataZoom = mergeOption(defaults.dataZoom, override)
	}

	if (Object.hasOwn(overrides, 'graphic')) {
		if (overrides.graphic === undefined) delete merged.graphic
		else merged.graphic = mergeOption(defaults.graphic, overrides.graphic)
	}
	if (Object.hasOwn(overrides, 'grid')) {
		if (overrides.grid === undefined) delete merged.grid
		else merged.grid = mergeOption(defaults.grid, overrides.grid)
	}
	if (Object.hasOwn(overrides, 'legend')) {
		if (overrides.legend === undefined) delete merged.legend
		else merged.legend = mergeOption(defaults.legend, overrides.legend)
	}
	if (Object.hasOwn(overrides, 'tooltip')) {
		if (overrides.tooltip === undefined) delete merged.tooltip
		else merged.tooltip = mergeOption(defaults.tooltip, overrides.tooltip)
	}
	if (Object.hasOwn(overrides, 'useUTC')) merged.useUTC = overrides.useUTC
	if (Object.hasOwn(overrides, 'xAxis')) {
		if (overrides.xAxis === undefined) delete merged.xAxis
		else merged.xAxis = mergeOption(defaults.xAxis, overrides.xAxis)
	}

	if (Object.hasOwn(overrides, 'yAxis')) {
		if (overrides.yAxis === undefined) delete merged.yAxis
		else if (Array.isArray(overrides.yAxis)) {
			const baseAxes = Array.isArray(defaults.yAxis) ? defaults.yAxis : [defaults.yAxis ?? {}]
			merged.yAxis = overrides.yAxis.map((axisOption, index) =>
				mergeYAxisOption(baseAxes[index] ?? baseAxes[0] ?? {}, axisOption)
			)
		} else {
			const baseAxis = Array.isArray(defaults.yAxis) ? (defaults.yAxis[0] ?? {}) : (defaults.yAxis ?? {})
			merged.yAxis = mergeYAxisOption(baseAxis, overrides.yAxis)
		}
	}

	return merged
}

function MultiSeriesChart(props: IMultiSeriesChartProps) {
	const {
		charts,
		chartOptions = EMPTY_CHART_OPTIONS,
		height,
		hallmarks,
		rangeHallmarks,
		hallmarksInMs = false,
		hallmarkStyle = 'event-rail',
		stateTimeline,
		expandTo100Percent,
		valueSymbol = '$',
		tooltipMaxItems,
		groupBy,
		alwaysShowTooltip,
		stacked = false,
		solidChartAreaStyle = false,
		hideDataZoom,
		autoHideDataZoom = true,
		showTotalInTooltip = false,
		requireCompleteTooltipTotal = false,
		onReady,
		hideDefaultLegend = true,
		selectedCharts,
		dataset,
		csvSource,
		exportButtons,
		title,
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
	const [validLegendIcons, setValidLegendIcons] = useState<ReadonlySet<string>>(() => new Set())
	const chartTheme = useChartTheme(isThemeDark)
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const chartDomRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const categoryLogosOverlayRef = useRef<HTMLDivElement>(null)
	const hasCategoryLogos = !!(categoryLogos && categoryLogos.some(Boolean))
	const eventHoverCleanupRef = useRef<(() => void) | null>(null)
	const eventHoverStateRef = useRef<EventHoverState>({ hoveredEventDate: null })
	const eventMarkLineGridRef = useRef<{ top: number; bottom: number } | null>(null)
	const categoryLogosFrameRef = useRef<number | null>(null)
	const categoryLogosLayoutRef = useRef<{
		categoryValues: Array<string | number | null | undefined>
		categoryLogos: Array<string>
		gridBottom: number
		logoBg: string
	} | null>(null)
	const latestTooltipDataIndexRef = useRef<number | null>(null)
	const chartMotion = useChartMotion()
	// Per-component tooltip size cache (used by tooltip.position). Keeping this in a ref avoids
	// recreating it on effect re-runs and prevents cross-chart interference.
	const tooltipSizeCacheRef = useRef<{ w: number; h: number; updatedAt: number } | null>(null)
	// The end-label formatter needs the live instance, but echarts calls it while painting, never during
	// render. A stable getter keeps the ref itself out of the series build below.
	const getChart = useStableCallback(() => chartRef.current)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const { hasEnteredRef } = persistentLifecycle

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, chartDomRef)

	const groupBySafe: GroupBy = groupBy ?? 'daily'

	const defaultChartSettings = useMemo<ResolvedMultiSeriesChartOptions>(() => {
		const themeColor = chartTheme.text
		const axisLabelColor = chartTheme.axisLabel

		const graphic = canvasWatermarkEnabled
			? {
					type: 'image',
					z: 0,
					style: {
						image: isThemeDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
						height: 40,
						opacity: 0.3
					},
					left: isSmall ? '40%' : '45%',
					top: '130px'
				}
			: undefined

		const xAxis: XAXisComponentOption = {
			type: 'time',
			boundaryGap: [0, 0],
			nameTextStyle: { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 400 },
			axisLabel: { color: axisLabelColor, hideOverlap: true },
			axisLine: { lineStyle: { color: themeColor, opacity: 0.2 } },
			splitLine: {
				lineStyle: { color: chartTheme.gridline }
			}
		}

		const yAxis: MultiSeriesYAxisOption = {
			type: 'value',
			boundaryGap: [0, 0],
			min: getZeroBaselineYAxisMin,
			nameTextStyle: { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 400 },
			axisLabel: {
				formatter: (value: number) => formatAxisLabel(value, valueSymbol),
				color: axisLabelColor
			},
			axisLine: { lineStyle: { color: themeColor, opacity: 0.1 } },
			splitLine: {
				lineStyle: { color: chartTheme.gridline }
			}
		}

		const legend: LegendComponentOption = {
			textStyle: {
				fontFamily: 'sans-serif',
				fontSize: 12,
				fontWeight: 400,
				color: themeColor
			}
		}

		const dataZoom: Array<DataZoomComponentOption> = [
			{ type: 'inside', start: 0, end: 100 },
			{
				start: 0,
				end: 100,
				...chartDataZoomSliderGeometry,
				textStyle: { color: themeColor },
				borderColor: chartTheme.zoomBorder,
				handleStyle: {
					borderColor: chartTheme.zoomHandleBorder,
					color: chartTheme.zoomHandleFill
				},
				moveHandleStyle: {
					color: chartTheme.zoomBorder
				},
				selectedDataBackground: {
					lineStyle: { color: chartTheme.ink(0.65), opacity: 1 },
					areaStyle: { color: chartTheme.ink(0.2), opacity: 1 }
				},
				emphasis: {
					handleStyle: {
						borderColor: chartTheme.zoomEmphasisBorder,
						color: chartTheme.zoomHandleBorder
					},
					moveHandleStyle: {
						borderColor: chartTheme.zoomEmphasisBorder,
						color: chartTheme.zoomEmphasisMoveFill
					}
				},
				fillerColor: chartTheme.zoomFiller,
				labelFormatter: formatChartEmphasisDate
			}
		]

		return { graphic, xAxis, yAxis, legend, dataZoom }
	}, [canvasWatermarkEnabled, chartTheme, isThemeDark, valueSymbol, isSmall])

	const datasetDimensions = dataset.dimensions
	const inferredCharts = useMemo(() => {
		const inferred: NonNullable<IMultiSeriesChartProps['charts']> = []
		const xDimensionIndex = Math.max(0, datasetDimensions.indexOf('timestamp'))
		for (let i = 0; i < datasetDimensions.length; i++) {
			const name = datasetDimensions[i]!
			if (i === xDimensionIndex) continue
			const colorIndex = inferred.length
			inferred.push({
				type: 'line',
				name,
				encode: { x: xDimensionIndex, y: i },
				color: CHART_COLORS[colorIndex % CHART_COLORS.length]!,
				...(stacked ? { stack: 'A' } : {})
			})
		}
		return inferred
	}, [datasetDimensions, stacked])
	const effectiveCharts = charts && charts.length > 0 ? charts : inferredCharts
	useEffect(() => {
		const urls = effectiveCharts.map((chart) => chart.legendIconUrl).filter((url): url is string => !!url)
		if (urls.length === 0) return
		let cancelled = false
		Promise.all(urls.map(validateIconUrl)).then((results) => {
			if (cancelled) return
			const valid = new Set<string>()
			for (let index = 0; index < urls.length; index++) {
				if (results[index]) valid.add(urls[index])
			}
			setValidLegendIcons(valid)
		})
		return () => {
			cancelled = true
		}
	}, [effectiveCharts])
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

	const hallmarksMarkLine = useMemo(
		() =>
			hallmarkStyle === 'mark-line' && hallmarks?.length
				? buildHallmarksMarkLine({ hallmarks, textColor: chartTheme.text, dateInMs: hallmarksInMs })
				: undefined,
		[hallmarkStyle, hallmarks, chartTheme.text, hallmarksInMs]
	)

	const { series, sourceAxisIndexes } = useMemo(() => {
		const builtSeries = buildMultiSeries({
			charts: renderedCharts,
			selectedCharts,
			expandTo100Percent,
			solidChartAreaStyle,
			chartTheme,
			hallmarksMarkLine,
			getChart,
			validLegendIcons
		})
		return normalizeSeriesYAxisIndices(builtSeries)
	}, [
		renderedCharts,
		chartTheme,
		expandTo100Percent,
		solidChartAreaStyle,
		selectedCharts,
		hallmarksMarkLine,
		getChart,
		validLegendIcons
	])
	const displayValueSymbol = expandTo100Percent ? '%' : valueSymbol

	const eventRailData = useMemo(
		() =>
			hallmarkStyle === 'event-rail'
				? buildEventRailData({ hallmarks, rangeHallmarks, isThemeDark, dateInMs: hallmarksInMs }).events
				: [],
		[hallmarkStyle, hallmarks, rangeHallmarks, isThemeDark, hallmarksInMs]
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
	const logEligibleYAxes = useMemo(() => {
		if (!sourceAxisIndexes || !props.logEligibleYAxes) return props.logEligibleYAxes
		const denseIndexes: Array<number> = []
		for (const sourceIndex of props.logEligibleYAxes) {
			const denseIndex = sourceAxisIndexes.indexOf(sourceIndex)
			if (denseIndex >= 0) denseIndexes.push(denseIndex)
		}
		return denseIndexes
	}, [props.logEligibleYAxes, sourceAxisIndexes])
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
	const defaultCsvSource = useMemo(() => {
		if (!renderedCharts.some((chart) => chart.data)) {
			return { type: 'dataset' as const, prepare: () => ({ ...dataset, groupBy: groupBySafe }) }
		}
		return {
			type: 'dataset' as const,
			prepare: () => {
				const independentSeries: Array<{
					name: string
					data: Array<[timestamp: number, value: number | null]>
				}> = []
				for (const chart of renderedCharts) {
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
	}, [dataset, renderedCharts, renderedDatasetSource, groupBySafe])
	// A caller's dataset export takes this chart's grouping unless it names its own.
	const exportCsvSource = useMemo<ChartCsvSource>(() => {
		if (!csvSource) return defaultCsvSource
		if (csvSource === 'rendered-chart' || csvSource.type !== 'dataset') return csvSource
		return { type: 'dataset', prepare: async () => ({ groupBy: groupBySafe, ...(await csvSource.prepare()) }) }
	}, [csvSource, defaultCsvSource, groupBySafe])
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
	const showLatestTooltip = useStableCallback(() => {
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
	const getEventMarkLineShape = useStableCallback((eventDate: number) => {
		const instance = chartRef.current
		const grid = eventMarkLineGridRef.current
		if (!instance || instance.isDisposed() || !grid) return null
		const x = instance.convertToPixel({ xAxisIndex: 0 }, eventDate)
		if (!Number.isFinite(x)) return null

		return {
			x1: x,
			y1: grid.top,
			x2: x,
			y2: instance.getHeight() - grid.bottom
		}
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

		return () => {
			persistentLifecycle.capture(instance)
			instance.off('finished', syncCategoryLogos)
			instance.off('globalout', showLatestTooltip)
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
			if (categoryLogosFrameRef.current != null) {
				cancelAnimationFrame(categoryLogosFrameRef.current)
				categoryLogosFrameRef.current = null
			}
			setChartLogoMetadata(instance, undefined)
			chartRef.current = null
			categoryLogosLayoutRef.current = null
			eventMarkLineGridRef.current = null
			latestTooltipDataIndexRef.current = null
			tooltipSizeCacheRef.current = null
			instance.dispose()
			handleChartReady(null)
			emitReady(null)
		}
	}, [handleChartReady, persistentLifecycle, showLatestTooltip, syncCategoryLogos])

	useEffect(() => {
		const instance = chartRef.current
		const el = chartDomRef.current
		if (!instance || !el || !syncGroup) return
		return joinChartHoverSync(syncGroup, instance, el)
	}, [syncGroup])

	useEffect(() => {
		handleChartReady(shouldEnableCSVDownload || shouldEnableImageExport ? chartRef.current : null)
	}, [handleChartReady, shouldEnableCSVDownload, shouldEnableImageExport])

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
		const shouldHideDataZoom = hideDataZoom || (autoHideDataZoom && datasetLength < 2)
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
		const finalLegend = hideDefaultLegend
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
			// ECharts expects `position` to be in *container coordinates* (even with `appendToBody`).
			// We clamp in viewport coordinates, then translate back to container coordinates.
			const margin = 12
			const offset = 16
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

			const containerOutsideViewport =
				containerRect.bottom <= 0 || containerRect.top >= vh || containerRect.right <= 0 || containerRect.left >= vw
			if (containerOutsideViewport) return OFFSCREEN_TOOLTIP_POSITION

			const pX = Number.isFinite(px) ? px : 0
			const pY = Number.isFinite(py) ? py : 0

			// Prefer positioning away from cursor so the tooltip never blocks hover tracking.
			let x = pX + offset
			let y = pY - tooltipH - offset

			// Flip horizontally/vertically when near edges.
			if (containerRect.left + x + tooltipW + margin > vw) {
				x = pX - tooltipW - offset
			}
			if (containerRect.top + y < margin) {
				y = pY + offset
			}

			const absX = containerRect.left + x
			const absY = containerRect.top + y

			const clampedAbsX = Math.min(Math.max(margin, absX), Math.max(margin, vw - tooltipW - margin))
			const clampedAbsY = Math.min(Math.max(margin, absY), Math.max(margin, vh - tooltipH - margin))

			return [clampedAbsX - containerRect.left, clampedAbsY - containerRect.top]
		}

		const baseTooltip = mergedChartSettings.tooltip ?? {}
		const tooltipOverride = Array.isArray(chartOptions?.tooltip) ? chartOptions.tooltip[0] : chartOptions?.tooltip
		const customTooltipFormatter = tooltipOverride?.formatter
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
			formatter: customTooltipFormatter ?? tooltipFormatter
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
				hideDefaultLegend ? CHART_INSET : CHART_LEGEND_RESERVE,
				hallmarksMarkLine ? CHART_INSET + CHART_HALLMARK_LABEL_RESERVE : 0
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
		eventMarkLineGridRef.current = {
			top: Number(finalGrid.top),
			bottom: Number(finalGrid.bottom)
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
						shouldHideDataZoom
					})
				]
			: shouldShowStateTimeline && stateTimeline
				? [
						...series,
						createStateTimelineSeries({ timeline: stateTimeline, yAxisIndex: eventStripYAxisIndex, shouldHideDataZoom })
					]
				: series
		const finalGraphic = shouldShowEventRail ? mergeGraphicWithEventMarkLinePlaceholder(graphic, isThemeDark) : graphic

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
		if (!hideDefaultLegend && renderedLegend !== undefined) option.legend = renderedLegend
		if (finalGraphic !== undefined) option.graphic = finalGraphic
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
		autoHideDataZoom,
		hideDefaultLegend,
		hallmarksMarkLine,
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
			hoverState: eventHoverStateRef.current,
			getEventMarkLineShape
		})

		return () => {
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
		}
	}, [eventRailData, getEventMarkLineShape])

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
						headingAs={headingAs}
						exportButtons={
							<ChartExportButtons
								chartInstance={chartInstance}
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

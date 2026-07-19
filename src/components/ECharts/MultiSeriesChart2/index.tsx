import { BarChart, CustomChart, LineChart } from 'echarts/charts'
import {
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TitleComponent,
	TooltipComponent,
	DatasetComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { buildCsvFromDataset } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	attachEventHoverHandlers,
	buildEventRailData,
	createEventRailSeries,
	createEventStripYAxis,
	type EventHoverState,
	getMainGridBottom,
	getDatasetTimeBounds,
	mergeGraphicWithEventMarkLinePlaceholder
} from '~/components/ECharts/hallmarkEventRail'
import { CHART_COLORS } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useMedia } from '~/hooks/useMedia'
import { useStableCallback } from '~/hooks/useStableCallback'
import { slug } from '~/utils'
import { ChartContainer } from '../ChartContainer'
import { ChartHeader } from '../ChartHeader'
import {
	CHART_INSET,
	CHART_LEGEND_RESERVE,
	chartDataZoomSliderGeometry,
	chartGrid,
	chartHorizontalScrollLegend,
	chartLegendScrollStyle
} from '../chartSpacing'
import { type ChartTheme, useChartTheme } from '../chartTheme'
import { formatChartEmphasisDate } from '../formatters'
import { buildHallmarksMarkLine } from '../hallmarks'
import type { IMultiSeriesChart2Props } from '../types'
import { mergeDeep } from '../utils'
import { getDisplayedDatasetDimensions } from './csvExport'
import { applyConfiguredYAxisScale, applyLogScaleToYAxes, getZeroBaselineYAxisMin } from './logScale'
import { buildMultiYAxis, formatAxisLabel, normalizeSeriesYAxisIndices } from './multiYAxis'
import { createTooltipFormatter } from './tooltip'

echarts.use([
	CanvasRenderer,
	LineChart,
	BarChart,
	CustomChart,
	TooltipComponent,
	TitleComponent,
	GridComponent,
	DataZoomComponent,
	GraphicComponent,
	MarkLineComponent,
	LegendComponent,
	DatasetComponent
])

function isChartDisposed(instance: echarts.ECharts) {
	return instance.isDisposed()
}

function dimensionsMatch(a: string[], b: string[]) {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}

type EncodedDimensions = NonNullable<IMultiSeriesChart2Props['charts']>[number]['encode']['x']
type GroupBy = NonNullable<IMultiSeriesChart2Props['groupBy']>

function remapEncodedDimensions(
	encoded: EncodedDimensions,
	datasetDimensions: string[],
	renderedDatasetDimensions: string[]
): EncodedDimensions {
	if (typeof encoded === 'string') return encoded
	const remap = (value: number) => {
		const dimension = datasetDimensions[value]
		const renderedIndex = renderedDatasetDimensions.indexOf(dimension)
		return renderedIndex >= 0 ? renderedIndex : value
	}
	if (typeof encoded === 'number') return remap(encoded)
	if (encoded.length === 0 || typeof encoded[0] === 'string') return encoded
	return (encoded as number[]).map(remap)
}

function createHatchPattern(color: string, opacity: number): { image: HTMLCanvasElement; repeat: 'repeat' } | null {
	if (typeof document === 'undefined') return null
	const size = 8
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) return null
	ctx.strokeStyle = color
	ctx.globalAlpha = opacity
	ctx.lineWidth = 1.5
	ctx.beginPath()
	ctx.moveTo(0, size)
	ctx.lineTo(size, 0)
	ctx.stroke()
	return { image: canvas, repeat: 'repeat' }
}

function createEndLabel({
	text,
	chartTheme,
	offset
}: {
	text: string
	chartTheme: ChartTheme
	offset: [number, number]
}) {
	return {
		show: true,
		formatter: text,
		fontSize: 16,
		fontWeight: 'bold',
		color: chartTheme.ink(0.3),
		offset
	}
}

function buildSeries({
	effectiveCharts,
	selectedCharts,
	expandTo100Percent,
	solidChartAreaStyle,
	chartTheme,
	hallmarksMarkLine
}: {
	effectiveCharts: IMultiSeriesChart2Props['charts']
	selectedCharts: IMultiSeriesChart2Props['selectedCharts']
	expandTo100Percent: boolean | undefined
	solidChartAreaStyle: boolean
	chartTheme: ChartTheme
	hallmarksMarkLine?: ReturnType<typeof buildHallmarksMarkLine>
}) {
	const out: any[] = []
	let someSeriesHasYAxisIndex = false

	const chartsList = effectiveCharts ?? []
	for (let i = 0; i < chartsList.length; i++) {
		const chart = chartsList[i]
		if (selectedCharts && !selectedCharts.has(chart.name)) continue
		if (chart.yAxisIndex != null) someSeriesHasYAxisIndex = true

		// If a chart doesn't provide an explicit color, we still need a stable color
		// so the area gradient doesn't default to theme background (and become invisible).
		const resolvedColor = chart.color ?? CHART_COLORS[i % CHART_COLORS.length]
		const showSymbol = chart.type === 'line' ? !!chart.showSymbol : false
		const symbol = showSymbol ? (chart.symbol ?? 'circle') : 'none'
		// ECharts large bar mode does not support stack layout.
		const large = chart.type === 'bar' ? (chart.large ?? chart.stack == null) : undefined
		const symbolSize = showSymbol ? (chart.symbolSize ?? 6) : undefined

		const base: any = {
			name: chart.name,
			type: chart.type,
			symbol,
			showSymbol,
			...(symbolSize != null ? { symbolSize } : {}),
			...(large != null ? { large } : {}),
			encode: chart.encode,
			emphasis: { focus: 'series', shadowBlur: 10 },
			itemStyle: { color: resolvedColor },
			...(chart.type === 'bar' && chart.barMinWidth != null ? { barMinWidth: chart.barMinWidth } : {}),
			...(chart.type === 'bar' && chart.barMaxWidth != null ? { barMaxWidth: chart.barMaxWidth } : {}),
			...(chart.yAxisIndex != null ? { yAxisIndex: chart.yAxisIndex } : {})
		}

		if (expandTo100Percent) {
			const isOverlay = chart.yAxisIndex != null && chart.yAxisIndex > 0
			if (!isOverlay) {
				base.stack = 'A'
				if (chart.type === 'line') {
					base.lineStyle = { width: 0, color: resolvedColor }
					base.areaStyle = {}
				}
			}
		} else {
			if (chart.stack != null) base.stack = chart.stack
			if (chart.type === 'line') {
				base.lineStyle = { color: resolvedColor }
				base.areaStyle = solidChartAreaStyle
					? { color: resolvedColor, opacity: 0.7 }
					: {
							color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
								{ offset: 0, color: resolvedColor },
								{
									offset: 1,
									color: chartTheme.areaGradientTo
								}
							])
						}
			}
		}

		if (chart.type === 'line' && chart.hideAreaStyle) {
			delete base.areaStyle
		}
		if (out.length === 0 && hallmarksMarkLine) {
			base.markLine = hallmarksMarkLine
		}
		if (chart.isTBD) {
			const hatch = createHatchPattern(resolvedColor, 0.4)
			base.itemStyle = { ...base.itemStyle, opacity: 0.3 }
			if (base.areaStyle) {
				base.areaStyle = hatch ? { color: hatch, opacity: 0.6 } : { ...base.areaStyle, opacity: 0.1 }
			}
			base.lineStyle = { ...(base.lineStyle ?? {}), type: 'dashed', width: 1.5, opacity: 0.5 }
			base.endLabel = createEndLabel({
				text: 'TBD',
				chartTheme,
				offset: [-40, 10]
			})
		} else if (chart.isForecast) {
			const hatch = createHatchPattern(resolvedColor, 0.8)
			base.itemStyle = { ...base.itemStyle, opacity: 0.5 }
			if (base.areaStyle) {
				base.areaStyle = hatch ? { color: hatch, opacity: 0.6 } : { ...base.areaStyle, opacity: 0.1 }
			}
			base.lineStyle = { ...(base.lineStyle ?? {}), type: 'dashed', width: 1.5, opacity: 0.5 }
			base.endLabel = createEndLabel({
				text: 'Forecast',
				chartTheme,
				offset: [-80, 15]
			})
		}

		out.push(base)
	}

	if (someSeriesHasYAxisIndex) {
		for (let i = 0; i < out.length; i++) out[i].yAxisIndex = out[i].yAxisIndex ?? 0
	}

	return out
}

const CATEGORY_LOGO_SIZE = 22
const CATEGORY_LOGO_BOTTOM_GAP = 10
const EMPTY_CHART_OPTIONS: NonNullable<IMultiSeriesChart2Props['chartOptions']> = {}

export default function MultiSeriesChart2(props: IMultiSeriesChart2Props) {
	const {
		charts,
		chartOptions = EMPTY_CHART_OPTIONS,
		height,
		hallmarks,
		hallmarkStyle = 'event-rail',
		expandTo100Percent,
		valueSymbol = '$',
		tooltipMaxItems,
		groupBy,
		alwaysShowTooltip,
		stacked = false,
		solidChartAreaStyle = false,
		hideDataZoom,
		showTotalInTooltip = false,
		onReady,
		hideDefaultLegend = true,
		selectedCharts,
		dataset,
		exportButtons,
		title,
		headingAs,
		containerClassName,
		categoryLogos
	} = props

	const [isThemeDark] = useDarkModeManager()
	const chartTheme = useChartTheme(isThemeDark)
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const chartDomRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const categoryLogosOverlayRef = useRef<HTMLDivElement>(null)
	const hasCategoryLogos = !!(categoryLogos && categoryLogos.length > 0 && categoryLogos.some(Boolean))
	const eventHoverCleanupRef = useRef<(() => void) | null>(null)
	const eventHoverStateRef = useRef<EventHoverState>({ hoveredEventDate: null })
	const eventMarkLineGridRef = useRef<{ top: number; bottom: number } | null>(null)
	const categoryLogosFrameRef = useRef<number | null>(null)
	const categoryLogosLayoutRef = useRef<{
		categoryValues: unknown[]
		categoryLogos: string[]
		gridBottom: number
		logoBg: string
	} | null>(null)
	const latestTooltipDataIndexRef = useRef<number | null>(null)
	// Per-component tooltip size cache (used by tooltip.position). Keeping this in a ref avoids
	// recreating it on effect re-runs and prevents cross-chart interference.
	const tooltipSizeCacheRef = useRef<{ w: number; h: number; updatedAt: number } | null>(null)
	const { chartInstance, handleChartReady } = useGetChartInstance()

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, chartDomRef)

	const groupBySafe: GroupBy = groupBy ?? 'daily'
	const tooltipGroupBy = groupBySafe === 'cumulative' ? 'daily' : groupBySafe

	const defaultChartSettings = useMemo(() => {
		const themeColor = chartTheme.text
		const axisLabelColor = chartTheme.axisLabel

		const graphic = {
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

		const xAxis = {
			type: 'time',
			boundaryGap: false,
			nameTextStyle: { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 400 },
			axisLabel: { color: axisLabelColor, hideOverlap: true },
			axisLine: { lineStyle: { color: themeColor, opacity: 0.2 } },
			splitLine: {
				lineStyle: { color: chartTheme.gridline }
			}
		}

		const yAxis = {
			type: 'value',
			boundaryGap: false,
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

		const legend = {
			textStyle: {
				fontFamily: 'sans-serif',
				fontSize: 12,
				fontWeight: 400,
				color: themeColor
			}
		}

		const dataZoom = [
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
	}, [chartTheme, isThemeDark, valueSymbol, isSmall])

	const datasetSource = dataset.source
	const datasetDimensions = dataset.dimensions
	const inferredCharts = useMemo(() => {
		const inferred: NonNullable<IMultiSeriesChart2Props['charts']> = []
		const xDimension = datasetDimensions.includes('timestamp') ? 'timestamp' : (datasetDimensions[0] ?? 'timestamp')
		for (let i = 0; i < datasetDimensions.length; i++) {
			const name = datasetDimensions[i]
			if (name === xDimension) continue
			const colorIndex = inferred.length
			inferred.push({
				type: 'line',
				name,
				encode: { x: xDimension, y: name },
				color: CHART_COLORS[colorIndex % CHART_COLORS.length],
				yAxisIndex: undefined,
				...(stacked ? { stack: 'A' } : {})
			})
		}
		return inferred
	}, [datasetDimensions, stacked])
	const effectiveCharts = charts && charts.length > 0 ? charts : inferredCharts
	const displayedCharts = useMemo(
		() => (selectedCharts ? effectiveCharts.filter((chart) => selectedCharts.has(chart.name)) : effectiveCharts),
		[effectiveCharts, selectedCharts]
	)
	const renderedDatasetDimensions = useMemo(() => {
		if (!selectedCharts) return datasetDimensions
		const displayedDimensions = getDisplayedDatasetDimensions(datasetDimensions, displayedCharts)
		if (displayedDimensions.length > 0) return displayedDimensions
		const xDimension = datasetDimensions.includes('timestamp') ? 'timestamp' : datasetDimensions[0]
		return xDimension == null ? [] : [xDimension]
	}, [datasetDimensions, displayedCharts, selectedCharts])
	const renderedDatasetSource = useMemo(() => {
		const requiresArrayRows =
			renderedDatasetDimensions.includes('hasOwnProperty') || renderedDatasetDimensions.includes('__proto__')
		if (!requiresArrayRows && dimensionsMatch(renderedDatasetDimensions, datasetDimensions)) return datasetSource
		return datasetSource.map((sourceRow) => {
			if (requiresArrayRows) {
				return renderedDatasetDimensions.map((dimension) => sourceRow[dimension])
			}
			const renderedRow: (typeof datasetSource)[number] = {}
			for (const dimension of renderedDatasetDimensions) renderedRow[dimension] = sourceRow[dimension]
			return renderedRow
		})
	}, [datasetDimensions, datasetSource, renderedDatasetDimensions])
	const renderedCharts = useMemo(() => {
		if (displayedCharts.length === 0 || dimensionsMatch(renderedDatasetDimensions, datasetDimensions)) {
			return effectiveCharts
		}
		return effectiveCharts.map((chart) => ({
			...chart,
			encode: {
				x: remapEncodedDimensions(chart.encode.x, datasetDimensions, renderedDatasetDimensions),
				y: remapEncodedDimensions(chart.encode.y, datasetDimensions, renderedDatasetDimensions)
			}
		}))
	}, [datasetDimensions, displayedCharts.length, effectiveCharts, renderedDatasetDimensions])

	const mergedChartSettings = useMemo(() => {
		// avoid mutating memoized defaults
		const mergedChartSettings: any = { ...defaultChartSettings }

		// override default chart settings
		for (const option in chartOptions) {
			if (option === 'overrides') continue
			if (
				option === 'dataZoom' &&
				Array.isArray(mergedChartSettings.dataZoom) &&
				chartOptions.dataZoom &&
				typeof chartOptions.dataZoom === 'object' &&
				!Array.isArray(chartOptions.dataZoom)
			) {
				mergedChartSettings.dataZoom = mergedChartSettings.dataZoom.map((zoomOption: any) =>
					mergeDeep(zoomOption, chartOptions.dataZoom)
				)
				continue
			}
			if (option === 'yAxis' && Array.isArray(chartOptions.yAxis)) {
				const baseAxes = Array.isArray(mergedChartSettings.yAxis)
					? mergedChartSettings.yAxis
					: [mergedChartSettings.yAxis ?? {}]
				mergedChartSettings.yAxis = chartOptions.yAxis.map((axisOption: any, index: number) =>
					mergeDeep(baseAxes[index] ?? baseAxes[0] ?? {}, axisOption)
				)
				continue
			}
			if (mergedChartSettings[option]) {
				mergedChartSettings[option] = mergeDeep(mergedChartSettings[option], chartOptions[option])
			} else {
				mergedChartSettings[option] = { ...chartOptions[option] }
			}
		}

		return mergedChartSettings
	}, [defaultChartSettings, chartOptions])

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
				? buildHallmarksMarkLine({ hallmarks, textColor: chartTheme.text, dateInMs: false })
				: undefined,
		[hallmarkStyle, hallmarks, chartTheme.text]
	)

	const { series, sourceAxisIndexes } = useMemo(() => {
		const builtSeries = buildSeries({
			effectiveCharts: renderedCharts,
			selectedCharts,
			expandTo100Percent,
			solidChartAreaStyle,
			chartTheme,
			hallmarksMarkLine
		})
		return normalizeSeriesYAxisIndices(builtSeries)
	}, [renderedCharts, chartTheme, expandTo100Percent, solidChartAreaStyle, selectedCharts, hallmarksMarkLine])
	const displayValueSymbol = expandTo100Percent ? '%' : valueSymbol

	const eventRailData = useMemo(
		() =>
			hallmarkStyle === 'event-rail' ? buildEventRailData({ hallmarks, isThemeDark, dateInMs: false }).events : [],
		[hallmarkStyle, hallmarks, isThemeDark]
	)

	const { seriesSymbols, tooltipTotalExcludedSeries } = useMemo(() => {
		let seriesSymbols: Map<string, string> | undefined
		let tooltipTotalExcludedSeries: Set<string> | undefined
		for (const chart of displayedCharts) {
			if (chart.valueSymbol != null) {
				seriesSymbols ??= new Map<string, string>()
				seriesSymbols.set(chart.name, chart.valueSymbol)
			}
			if (chart.excludeFromTooltipTotal) {
				tooltipTotalExcludedSeries ??= new Set<string>()
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
		const denseIndexes: number[] = []
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
				showTotalInTooltip
			}),
		[groupBySafe, displayValueSymbol, seriesSymbols, tooltipTotalExcludedSeries, tooltipMaxItems, showTotalInTooltip]
	)

	const exportFilename = exportButtonsConfig?.filename || (title ? slug(title) : 'multi-series-chart')
	const exportTitle = exportButtonsConfig?.pngTitle || title
	const selectedCsvDimensions = useMemo(
		() => (selectedCharts ? getDisplayedDatasetDimensions(datasetDimensions, displayedCharts) : null),
		[datasetDimensions, displayedCharts, selectedCharts]
	)
	const prepareCsvDirect = useMemo(
		() =>
			selectedCsvDimensions
				? () =>
						buildCsvFromDataset({
							dimensions: selectedCsvDimensions,
							source: datasetSource,
							filenameBase: exportFilename
						})
				: undefined,
		[selectedCsvDimensions, datasetSource, exportFilename]
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
			const x = instance.convertToPixel({ xAxisIndex: 0 }, categoryValue as any)
			if (!Number.isFinite(x)) continue
			const img = document.createElement('img')
			img.src = url
			img.alt = ''
			img.loading = 'lazy'
			img.decoding = 'async'
			img.title = String(categoryValue)
			img.style.cssText = `position:absolute;left:${x - CATEGORY_LOGO_SIZE / 2}px;top:${centerY - CATEGORY_LOGO_SIZE / 2}px;width:${CATEGORY_LOGO_SIZE}px;height:${CATEGORY_LOGO_SIZE}px;border-radius:50%;object-fit:cover;background:${layout.logoBg};pointer-events:none;`
			img.onerror = () => img.remove()
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
		emitReady(instance)
		instance.on('finished', syncCategoryLogos)
		instance.on('globalout', showLatestTooltip)

		return () => {
			instance.off('finished', syncCategoryLogos)
			instance.off('globalout', showLatestTooltip)
			eventHoverCleanupRef.current?.()
			eventHoverCleanupRef.current = null
			if (categoryLogosFrameRef.current != null) {
				cancelAnimationFrame(categoryLogosFrameRef.current)
				categoryLogosFrameRef.current = null
			}
			delete (instance as any).__llamaChartLogos
			chartRef.current = null
			categoryLogosLayoutRef.current = null
			eventMarkLineGridRef.current = null
			latestTooltipDataIndexRef.current = null
			tooltipSizeCacheRef.current = null
			instance.dispose()
			handleChartReady(null)
			emitReady(null)
		}
	}, [handleChartReady, showLatestTooltip, syncCategoryLogos])

	useEffect(() => {
		handleChartReady(shouldEnableCSVDownload || shouldEnableImageExport ? chartRef.current : null)
	}, [handleChartReady, shouldEnableCSVDownload, shouldEnableImageExport])

	useEffect(() => {
		const instance = chartRef.current
		const el = chartDomRef.current
		if (!instance || !el) return

		const { legend, graphic, xAxis, dataZoom, dataset: datasetOptions } = mergedChartSettings

		const datasetLength = datasetSource.length
		const shouldHideDataZoom = datasetLength < 2 || hideDataZoom
		const shouldShowEventRail = eventRailData.length > 0

		// Always use a scroll legend when the default legend is enabled. ECharts
		// decides whether paging is needed; asymmetric padding supplies the left
		// clip inset without forcing short legends away from right alignment.
		const legendScrollStyle = chartLegendScrollStyle(
			chartTheme.legendPageActive,
			chartTheme.legendPageInactive,
			chartTheme.axisLabel
		)
		const getScrollLegend = (legendOption: any) => chartHorizontalScrollLegend(legendOption, legendScrollStyle)
		const finalLegend = hideDefaultLegend
			? undefined
			: Array.isArray(legend)
				? legend.map(getScrollLegend)
				: legend
					? getScrollLegend(legend)
					: undefined

		const datasetForOption = {
			...(datasetOptions ?? {}),
			source: renderedDatasetSource,
			dimensions: selectedCharts ? renderedDatasetDimensions : (datasetOptions?.dimensions ?? datasetDimensions)
		}

		const clampTooltipToViewport = (point: any, params: any, dom: any, _rect: any, size: any) => {
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
			} else if (rows > 20 && dom?.getBoundingClientRect) {
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
		const customTooltipFormatter = chartOptions?.tooltip?.formatter
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

		const tooltipConfig = {
			...baseTooltip,
			appendToBody: alwaysShowTooltip ? undefined : true,
			renderMode: 'html',
			className: alwaysShowTooltip ? undefined : 'defillama-echarts-tooltip',
			...(alwaysShowTooltip ? {} : { backgroundColor: 'transparent', borderWidth: 0 }),
			enterable,
			// Clamp to the browser viewport (not the chart grid).
			confine: false,
			position: clampTooltipToViewport,
			extraCssText,
			trigger: 'axis',
			formatter: customTooltipFormatter ?? tooltipFormatter
		}

		const baseGrid = chartGrid({
			bottom: getMainGridBottom({ shouldShowEventRail, shouldHideDataZoom }),
			top: hideDefaultLegend ? CHART_INSET : CHART_LEGEND_RESERVE
		})
		const finalGrid = mergedChartSettings.grid ? mergeDeep(baseGrid, mergedChartSettings.grid) : baseGrid
		const hasExplicitGridBottom = mergedChartSettings.grid?.bottom != null
		if (!hasExplicitGridBottom) {
			finalGrid.bottom = getMainGridBottom({ shouldShowEventRail, shouldHideDataZoom })
		}
		if (hasCategoryLogos) {
			finalGrid.bottom = Number(finalGrid.bottom ?? 12) + CATEGORY_LOGO_SIZE + CATEGORY_LOGO_BOTTOM_GAP
			finalGrid.outerBoundsContain = undefined
		}
		eventMarkLineGridRef.current = {
			top: Number(finalGrid.top),
			bottom: Number(finalGrid.bottom)
		}

		const { min: timeRangeMin, max: timeRangeMax } = shouldShowEventRail
			? getDatasetTimeBounds(datasetSource, 'timestamp')
			: { min: undefined, max: undefined }
		const hasTimeRange =
			typeof timeRangeMin === 'number' &&
			Number.isFinite(timeRangeMin) &&
			typeof timeRangeMax === 'number' &&
			Number.isFinite(timeRangeMax) &&
			timeRangeMin < timeRangeMax

		let finalXAxis: any =
			shouldShowEventRail && hasTimeRange ? { ...xAxis, min: timeRangeMin, max: timeRangeMax } : xAxis
		if (hasCategoryLogos) {
			finalXAxis = {
				...finalXAxis,
				axisLabel: { ...(finalXAxis?.axisLabel ?? {}), show: false },
				axisTick: { ...(finalXAxis?.axisTick ?? {}), show: false }
			}
		}
		const eventStripYAxisIndex = finalYAxisBase.length
		const finalYAxisWithEvents = shouldShowEventRail ? [...finalYAxisBase, createEventStripYAxis()] : finalYAxisBase
		const finalSeries = shouldShowEventRail
			? [
					...series,
					createEventRailSeries({
						eventRailData,
						eventStripYAxisIndex,
						hoverState: eventHoverStateRef.current,
						shouldHideDataZoom,
						tooltipGroupBy
					})
				]
			: series
		const finalGraphic = shouldShowEventRail ? mergeGraphicWithEventMarkLinePlaceholder(graphic, isThemeDark) : graphic

		instance.setOption(
			{
				...(hideDefaultLegend ? {} : { legend: finalLegend ?? legend }),
				graphic: finalGraphic,
				tooltip: tooltipConfig,
				grid: finalGrid,
				xAxis: finalXAxis,
				yAxis: finalYAxisWithEvents,
				...(shouldHideDataZoom ? {} : { dataZoom }),
				...(chartOptions?.toolbox ? { toolbox: chartOptions.toolbox } : {}),
				series: finalSeries,
				dataset: datasetForOption
			},
			{ notMerge: true }
		)

		if (hasCategoryLogos) {
			const categoryValues = datasetSource.map((row: any) => row?.[datasetDimensions[0]])
			;(instance as any).__llamaChartLogos = {
				kind: 'cartesian-x',
				logos: categoryLogos!,
				categoryValues
			}
			categoryLogosLayoutRef.current = {
				categoryValues,
				categoryLogos: categoryLogos!,
				gridBottom: Number(finalGrid.bottom),
				logoBg: chartTheme.logoBg
			}
		} else {
			delete (instance as any).__llamaChartLogos
			categoryLogosLayoutRef.current = null
		}
		if (categoryLogosFrameRef.current != null) cancelAnimationFrame(categoryLogosFrameRef.current)
		categoryLogosFrameRef.current = hasCategoryLogos
			? requestAnimationFrame(() => {
					categoryLogosFrameRef.current = null
					syncCategoryLogos()
				})
			: null

		if (alwaysShowTooltip && series.length > 0 && datasetLength > 0) {
			latestTooltipDataIndexRef.current = datasetLength - 1
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
		hideDefaultLegend,
		selectedCharts,
		datasetSource,
		datasetDimensions,
		renderedDatasetSource,
		renderedDatasetDimensions,
		valueSymbol,
		tooltipFormatter,
		eventRailData,
		tooltipGroupBy,
		isThemeDark,
		chartTheme,
		finalYAxisBase,
		categoryLogos,
		hasCategoryLogos,
		showLatestTooltip,
		syncCategoryLogos
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
								prepareCsvDirect={prepareCsvDirect}
							/>
						}
					/>
				) : null
			}
		/>
	)
}

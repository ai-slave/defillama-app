import type {
	DefaultLabelFormatterCallbackParams,
	EChartsOption,
	GridComponentOption,
	XAXisComponentOption,
	YAXisComponentOption
} from 'echarts'
import {
	BarChart,
	CandlestickChart,
	LineChart,
	type BarSeriesOption,
	type CandlestickSeriesOption,
	type LineSeriesOption
} from 'echarts/charts'
import {
	DatasetComponent,
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	MarkLineComponent,
	TooltipComponent
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { oldBlue } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { useMedia } from '~/hooks/useMedia'
import { usePersistentEChartsLifecycle, withEChartsRenderVisibility } from '../renderVisibility'
import {
	CHART_INSET,
	CHART_LEGEND_RESERVE,
	CHART_ZOOM_RESERVE,
	chartDataZoomSliderGeometry
} from '../shared/chartSpacing'
import { useChartTheme } from '../shared/chartTheme'
import { formatChartEmphasisDate, formatTooltipChartDate, formatTooltipValue } from '../shared/formatters'
import { normalizeTooltipItems } from '../shared/tooltip'
import type { ICandlestickChartProps } from './types'

echarts.use([
	CanvasRenderer,
	CandlestickChart,
	BarChart,
	LineChart,
	TooltipComponent,
	GridComponent,
	DataZoomComponent,
	GraphicComponent,
	MarkLineComponent,
	DatasetComponent,
	LegendComponent
])

const EMPTY_INDICATORS: NonNullable<ICandlestickChartProps['indicators']> = []

const INDICATOR_COLORS = ['#ff7f0e', '#2ca02c', '#9467bd', '#e377c2', '#17becf', '#bcbd22', '#7f7f7f']

const PANEL_HEIGHT = 60
const VOLUME_HEIGHT = 80
const BASE_BOTTOM = CHART_ZOOM_RESERVE

function CandleStickAndVolumeChart({ data, height, indicators = EMPTY_INDICATORS, onReady }: ICandlestickChartProps) {
	const [isThemeDark] = useDarkModeManager()
	const isSmall = useMedia(`(max-width: 37.5rem)`)
	const chartTheme = useChartTheme(isThemeDark)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const persistentLifecycle = usePersistentEChartsLifecycle()
	const emitReady = useEffectEvent((instance: echarts.ECharts | null) => {
		onReady?.(instance)
	})

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	const overlays = useMemo(() => indicators.filter((i) => i.category === 'overlay'), [indicators])
	const panels = useMemo(() => indicators.filter((i) => i.category === 'panel'), [indicators])

	const chartHeight = 480 + panels.length * PANEL_HEIGHT

	const defaultChartSettings = useMemo<EChartsOption>(() => {
		const panelCount = panels.length
		const volumeBottom = BASE_BOTTOM + panelCount * PANEL_HEIGHT
		const priceBottom = volumeBottom + VOLUME_HEIGHT + 20
		const showLegend = overlays.length > 0 || panels.length > 0

		const grids: Array<GridComponentOption> = [
			{
				left: 48,
				bottom: priceBottom,
				top: showLegend ? CHART_LEGEND_RESERVE : CHART_INSET,
				right: CHART_INSET
			},
			{
				height: VOLUME_HEIGHT,
				left: 48,
				right: CHART_INSET,
				bottom: volumeBottom
			}
		]

		const xAxes: Array<XAXisComponentOption> = [
			{
				type: 'time',
				boundaryGap: [0, 0],
				axisLine: {
					onZero: false,
					lineStyle: { color: chartTheme.text, opacity: 0.2 }
				},
				splitLine: { show: false },
				min: 'dataMin',
				max: 'dataMax',
				axisLabel: { color: chartTheme.axisLabel }
			},
			{
				type: 'time',
				gridIndex: 1,
				boundaryGap: [0, 0],
				axisLine: {
					onZero: false,
					lineStyle: { color: chartTheme.text, opacity: 0.2 }
				},
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
				min: 'dataMin',
				max: 'dataMax'
			}
		]

		const yAxes: Array<YAXisComponentOption> = [
			{
				scale: true,
				splitArea: {
					show: true,
					areaStyle: { color: [chartTheme.ink(0.02), ''] }
				},
				axisLabel: {
					formatter: (value: number) => formatTooltipValue(value, '$'),
					color: chartTheme.axisLabel
				},
				axisLine: { lineStyle: { color: chartTheme.text, opacity: 0.1 } },
				splitLine: { lineStyle: { color: chartTheme.gridline } }
			},
			{
				scale: true,
				gridIndex: 1,
				splitNumber: 2,
				axisLabel: { show: false },
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false }
			}
		]

		for (let idx = 0; idx < panels.length; idx++) {
			const panel = panels[idx]!
			const gridIdx = idx + 2
			const bottom = BASE_BOTTOM + (panelCount - idx - 1) * PANEL_HEIGHT

			grids.push({
				height: PANEL_HEIGHT - 10,
				left: 48,
				right: CHART_INSET,
				bottom,
				outerBoundsMode: 'same',
				outerBoundsContain: 'axisLabel'
			})

			xAxes.push({
				type: 'time',
				gridIndex: gridIdx,
				boundaryGap: [0, 0],
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
				min: 'dataMin',
				max: 'dataMax'
			})

			const isOscillator = ['rsi', 'stoch', 'mfi', 'willr', 'cci'].some((t) => panel.name.toLowerCase().startsWith(t))
			const yAxis: YAXisComponentOption = {
				scale: !isOscillator,
				gridIndex: gridIdx,
				splitNumber: 2,
				axisLabel: { show: true, fontSize: 10, color: chartTheme.axisLabel },
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { lineStyle: { color: chartTheme.gridline } }
			}
			if (isOscillator) {
				yAxis.min = 0
				yAxis.max = 100
			}
			yAxes.push(yAxis)
		}

		const allAxisIndices = Array.from({ length: grids.length }, (_, i) => i)
		const legendData = ['Volume']
		for (const overlay of overlays) legendData.push(overlay.name)
		for (const panel of panels) {
			const panelName = panel.name.toLowerCase()
			if (panel.values && panelName.includes('macd')) legendData.push('MACD', 'Signal', 'MACD Line')
			else if (panel.values && panelName.includes('stoch')) legendData.push('%K', '%D')
			else legendData.push(panel.name)
		}

		return {
			// Match the UTC tooltip and zoom labels: ticks sit on UTC-midnight candles in every timezone.
			useUTC: true,
			graphic: {
				type: 'image',
				z: 0,
				style: {
					image: isThemeDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
					height: 40,
					opacity: 0.3
				},
				left: isSmall ? '40%' : '45%',
				top: '130px'
			},
			legend: {
				show: showLegend,
				// Bollinger upper/lower series shape the band but are controlled by the middle-series legend item.
				data: legendData,
				top: CHART_INSET,
				right: CHART_INSET,
				textStyle: { color: chartTheme.text, fontSize: 11 }
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'line' },
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0,
				formatter: (params: unknown) => {
					const items = normalizeTooltipItems(params)
					const firstValues = Array.isArray(items[0]?.value) ? items[0].value : []
					const chartdate = formatTooltipChartDate(Number(firstValues[0]), 'daily')
					let vals = ''
					for (const param of items) {
						const values = Array.isArray(param.value) ? param.value : []
						if (param.componentSubType === 'candlestick') {
							vals += `<li style="list-style:none">Open: <b>${formatTooltipValue(Number(values[1]), '$')}</b></li>`
							vals += `<li style="list-style:none">High: <b>${formatTooltipValue(Number(values[4]), '$')}</b></li>`
							vals += `<li style="list-style:none">Low: <b>${formatTooltipValue(Number(values[3]), '$')}</b></li>`
							vals += `<li style="list-style:none">Close: <b>${formatTooltipValue(Number(values[2]), '$')}</b></li>`
						} else if (param.seriesName === 'Volume') {
							vals += `<li style="list-style:none">${param.marker ?? ''}Vol: <b>${formatTooltipValue(Number(values[5]), '$')}</b></li>`
						} else {
							vals += `<li style="list-style:none">${param.marker ?? ''}${param.seriesName ?? ''}: <b>${formatTooltipValue(Number(values[1]), '')}</b></li>`
						}
					}
					return chartdate + vals
				}
			},
			grid: grids,
			xAxis: xAxes,
			yAxis: yAxes,
			dataZoom: [
				{ type: 'inside', xAxisIndex: allAxisIndices, start: 0, end: 100 },
				{
					show: true,
					xAxisIndex: allAxisIndices,
					type: 'slider',
					...chartDataZoomSliderGeometry,
					start: 0,
					end: 100,
					textStyle: { color: chartTheme.text },
					borderColor: chartTheme.zoomBorder,
					handleStyle: {
						borderColor: chartTheme.zoomHandleBorder,
						color: chartTheme.zoomHandleFill
					},
					moveHandleStyle: { color: chartTheme.zoomBorder },
					selectedDataBackground: { lineStyle: { color: oldBlue }, areaStyle: { color: oldBlue } },
					fillerColor: chartTheme.zoomFiller,
					labelFormatter: formatChartEmphasisDate
				}
			]
		}
	}, [isSmall, isThemeDark, chartTheme, panels, overlays])

	const series = useMemo(() => {
		const result: Array<CandlestickSeriesOption | BarSeriesOption | LineSeriesOption> = [
			{
				type: 'candlestick',
				large: true,
				itemStyle: {
					color: chartTheme.up,
					color0: chartTheme.down,
					borderColor: chartTheme.up,
					borderColor0: chartTheme.down
				},
				encode: { x: 0, y: [1, 2, 3, 4] }
			},
			{
				name: 'Volume',
				type: 'bar',
				large: true,
				xAxisIndex: 1,
				yAxisIndex: 1,
				encode: { x: 0, y: 5 },
				itemStyle: { color: oldBlue }
			}
		]

		for (let idx = 0; idx < overlays.length; idx++) {
			const ind = overlays[idx]!
			const color = ind.color || INDICATOR_COLORS[idx % INDICATOR_COLORS.length]!
			if (ind.values && ind.name.toLowerCase().includes('bband')) {
				result.push({
					name: `${ind.name} Upper`,
					type: 'line',
					data: ind.values.map((v) => [v[0], v[1].upper ?? null]),
					lineStyle: { color, opacity: 0.5, width: 1 },
					symbol: 'none'
				})
				result.push({
					name: ind.name,
					type: 'line',
					data: ind.values.map((v) => [v[0], v[1].middle ?? null]),
					lineStyle: { color, width: 1 },
					symbol: 'none'
				})
				result.push({
					name: `${ind.name} Lower`,
					type: 'line',
					data: ind.values.map((v) => [v[0], v[1].lower ?? null]),
					lineStyle: { color, opacity: 0.5, width: 1 },
					symbol: 'none',
					areaStyle: { color, opacity: 0.1 }
				})
			} else {
				result.push({
					name: ind.name,
					type: 'line',
					data: ind.data,
					lineStyle: { color, width: 1.5 },
					symbol: 'none'
				})
			}
		}

		for (let idx = 0; idx < panels.length; idx++) {
			const panel = panels[idx]!
			const gridIdx = idx + 2
			const color = panel.color || INDICATOR_COLORS[(overlays.length + idx) % INDICATOR_COLORS.length]!

			if (panel.values && panel.name.toLowerCase().includes('macd')) {
				result.push({
					name: 'MACD',
					type: 'bar',
					xAxisIndex: gridIdx,
					yAxisIndex: gridIdx,
					data: panel.values.map((v) => [v[0], v[1].histogram ?? null]),
					itemStyle: {
						color: (params: DefaultLabelFormatterCallbackParams) => {
							const value = Array.isArray(params.value) ? params.value[1] : undefined
							return typeof value === 'number' && value >= 0 ? chartTheme.up : chartTheme.down
						}
					}
				})
				result.push({
					name: 'Signal',
					type: 'line',
					xAxisIndex: gridIdx,
					yAxisIndex: gridIdx,
					data: panel.values.map((v) => [v[0], v[1].signal ?? null]),
					lineStyle: { color: '#ff7f0e', width: 1 },
					symbol: 'none'
				})
				result.push({
					name: 'MACD Line',
					type: 'line',
					xAxisIndex: gridIdx,
					yAxisIndex: gridIdx,
					data: panel.values.map((v) => [v[0], v[1].macd ?? null]),
					lineStyle: { color: '#2ca02c', width: 1 },
					symbol: 'none'
				})
			} else if (panel.values && panel.name.toLowerCase().includes('stoch')) {
				result.push({
					name: '%K',
					type: 'line',
					xAxisIndex: gridIdx,
					yAxisIndex: gridIdx,
					data: panel.values.map((v) => [v[0], v[1].k ?? null]),
					lineStyle: { color: '#2ca02c', width: 1 },
					symbol: 'none'
				})
				result.push({
					name: '%D',
					type: 'line',
					xAxisIndex: gridIdx,
					yAxisIndex: gridIdx,
					data: panel.values.map((v) => [v[0], v[1].d ?? null]),
					lineStyle: { color: '#ff7f0e', width: 1 },
					symbol: 'none'
				})
			} else {
				result.push({
					name: panel.name,
					type: 'line',
					xAxisIndex: gridIdx,
					yAxisIndex: gridIdx,
					data: panel.data,
					lineStyle: { color, width: 1.5 },
					symbol: 'none'
				})
			}
		}

		return result
	}, [chartTheme, overlays, panels])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance
		persistentLifecycle.restore(instance)
		emitReady(instance)

		return () => {
			persistentLifecycle.capture(instance)
			chartRef.current = null
			instance.dispose()
			emitReady(null)
		}
	}, [persistentLifecycle])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option: EChartsOption = {
			...defaultChartSettings,
			dataset: { source: data },
			series
		}
		instance.setOption(
			option,
			// When indicators change we change the number of grids/axes/series.
			// ECharts merges arrays by index by default, which can leave stale layout components
			// (making grid.left/right look like they "don't apply"). Replace-merge fixes that.
			{ replaceMerge: ['grid', 'xAxis', 'yAxis', 'series', 'dataZoom', 'dataset'] }
		)
	}, [series, data, defaultChartSettings])

	return <div ref={containerRef} style={{ height: height ?? `${chartHeight}px` }} />
}

export default withEChartsRenderVisibility(CandleStickAndVolumeChart)

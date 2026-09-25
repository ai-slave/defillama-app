import type { DataZoomComponentOption, LegendComponentOption, XAXisComponentOption } from 'echarts'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import { CHART_COLORS } from '~/constants/colors'
import { chartDataZoomSliderGeometry } from '../shared/chartSpacing'
import type { ChartTheme } from '../shared/chartTheme'
import { formatChartEmphasisDate } from '../shared/formatters'
import { mergeDeep } from '../shared/merge'
import { getZeroBaselineYAxisMin, mergeYAxisOption } from './logScale'
import { formatAxisLabel } from './multiYAxis'
import type { IMultiSeriesChartProps, MultiSeriesChartOptions, MultiSeriesYAxisOption } from './types'

export type ResolvedMultiSeriesChartOptions = Omit<MultiSeriesChartOptions, 'yAxis'> & {
	yAxis?: MultiSeriesYAxisOption | Array<MultiSeriesYAxisOption>
}

export function buildDefaultChartSettings({
	chartTheme,
	canvasWatermarkEnabled,
	isThemeDark,
	isSmall,
	valueSymbol
}: {
	chartTheme: ChartTheme
	canvasWatermarkEnabled: boolean
	isThemeDark: boolean
	isSmall: boolean
	valueSymbol: string
}): ResolvedMultiSeriesChartOptions {
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
}

function mergeOption<T>(base: T | undefined, override: T): T {
	return base === undefined ? override : mergeDeep(base, override)
}

export function mergeChartOptions(
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

/** Without configured charts, every dimension except the x dimension (`timestamp`, else the first) is a line. */
export function inferMultiSeriesCharts(
	dimensions: ReadonlyArray<string>,
	stacked: boolean
): NonNullable<IMultiSeriesChartProps['charts']> {
	const inferred: NonNullable<IMultiSeriesChartProps['charts']> = []
	const xDimensionIndex = Math.max(0, dimensions.indexOf('timestamp'))
	for (let i = 0; i < dimensions.length; i++) {
		const name = dimensions[i]!
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
}

/** Log eligibility names source axes; once sparse axes are remapped densely, it has to follow them. */
export function remapLogEligibleYAxes(
	logEligibleYAxes: Array<number> | undefined,
	sourceAxisIndexes: Array<number> | null
): Array<number> | undefined {
	if (!sourceAxisIndexes || !logEligibleYAxes) return logEligibleYAxes
	const denseIndexes: Array<number> = []
	for (const sourceIndex of logEligibleYAxes) {
		const denseIndex = sourceAxisIndexes.indexOf(sourceIndex)
		if (denseIndex >= 0) denseIndexes.push(denseIndex)
	}
	return denseIndexes
}

/** A caller's dataset export takes this chart's grouping unless it names its own. */
export function withChartGroupBy(
	csvSource: ChartCsvSource,
	groupBy: NonNullable<IMultiSeriesChartProps['groupBy']>
): ChartCsvSource {
	if (csvSource === 'rendered-chart' || csvSource.type !== 'dataset') return csvSource
	return { type: 'dataset', prepare: async () => ({ groupBy, ...(await csvSource.prepare()) }) }
}

export const OFFSCREEN_TOOLTIP_POSITION: [number, number] = [-100_000, -100_000]

type Rect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>

/**
 * ECharts expects `position` in container coordinates (even with `appendToBody`). The tooltip is clamped
 * in viewport coordinates and translated back. A chart scrolled out of the viewport parks its tooltip
 * offscreen instead of pinning it to a viewport edge.
 */
export function getViewportTooltipPosition({
	point,
	tooltipSize: [tooltipW, tooltipH],
	containerRect,
	viewport: [vw, vh]
}: {
	point: [number, number]
	tooltipSize: [number, number]
	containerRect: Rect
	viewport: [number, number]
}): [number, number] {
	const margin = 12
	const offset = 16

	const containerOutsideViewport =
		containerRect.bottom <= 0 || containerRect.top >= vh || containerRect.right <= 0 || containerRect.left >= vw
	if (containerOutsideViewport) return OFFSCREEN_TOOLTIP_POSITION

	const [pX, pY] = point

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

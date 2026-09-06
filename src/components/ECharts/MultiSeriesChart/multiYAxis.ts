import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { IMultiSeriesChartProps, MultiSeriesYAxisOption, MultiSeriesYAxisOverride } from './types'

export function formatAxisLabel(value: number, symbol: string): string {
	if (Math.abs(value) > 1000) {
		if (symbol === '$')
			return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		const base = formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		if (!symbol) return base
		if (symbol === '%')
			return formatPercent(value, {
				input: 'percent',
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			})
		return `${base} ${symbol}`
	}

	if (symbol === '$') return formatUsd(value, { maximumFractionDigits: 5 })
	if (symbol === '%') return formatPercent(value, { input: 'percent', maximumFractionDigits: 5 })
	const formatted = formatNumber(value, { maximumFractionDigits: 5 })
	return symbol ? `${formatted} ${symbol}` : formatted
}

type RenderSeries = {
	name?: string
	yAxisIndex?: number
	itemStyle?: { color?: unknown }
}

export function normalizeSeriesYAxisIndices<TSeries extends RenderSeries>(series: Array<TSeries>) {
	const sourceAxisIndexSet = new Set<number>()
	let hasExplicitAxisIndex = false
	for (const item of series) {
		if (item.yAxisIndex != null) hasExplicitAxisIndex = true
		sourceAxisIndexSet.add(item.yAxisIndex ?? 0)
	}
	if (!hasExplicitAxisIndex) return { series, sourceAxisIndexes: null }

	const sourceAxisIndexes = Array.from(sourceAxisIndexSet).sort((a, b) => a - b)
	let isDense = true
	for (let i = 0; i < sourceAxisIndexes.length; i++) {
		if (sourceAxisIndexes[i] !== i) {
			isDense = false
			break
		}
	}
	if (isDense) return { series, sourceAxisIndexes }

	const denseIndexBySource = new Map<number, number>()
	for (const [denseIndex, sourceIndex] of sourceAxisIndexes.entries()) {
		denseIndexBySource.set(sourceIndex, denseIndex)
	}

	return {
		series: series.map((item) => ({ ...item, yAxisIndex: denseIndexBySource.get(item.yAxisIndex ?? 0) ?? 0 })),
		sourceAxisIndexes
	}
}

export function buildMultiYAxis({
	series,
	yAxis,
	configuredYAxis,
	expandTo100Percent,
	effectiveCharts,
	valueSymbol,
	sourceAxisIndexes
}: {
	series: Array<RenderSeries>
	yAxis: MultiSeriesYAxisOption | Array<MultiSeriesYAxisOption> | undefined
	configuredYAxis?: MultiSeriesYAxisOverride | Array<MultiSeriesYAxisOverride> | undefined
	expandTo100Percent: boolean | undefined
	effectiveCharts: IMultiSeriesChartProps['charts']
	valueSymbol: string
	sourceAxisIndexes: Array<number> | null
}) {
	const renderedAxisColors = new Map<number, Set<string>>()
	const yAxisIndexToExplicitColor = new Map<number, string | undefined>()
	const yAxisIndexToSymbol = new Map<number, string | undefined>()
	let maxIndex = -1

	for (const item of series) {
		const index = item.yAxisIndex
		if (index == null) continue
		const color = typeof item.itemStyle?.color === 'string' ? item.itemStyle.color : undefined
		if (color) {
			const colors = renderedAxisColors.get(index) ?? new Set<string>()
			colors.add(color)
			renderedAxisColors.set(index, colors)
		}
		if (index > maxIndex) maxIndex = index
	}
	if (maxIndex < 0 && series.length > 0) maxIndex = 0

	const denseIndexBySource = new Map<number, number>()
	if (sourceAxisIndexes) {
		for (const [denseIndex, sourceIndex] of sourceAxisIndexes.entries()) {
			denseIndexBySource.set(sourceIndex, denseIndex)
		}
	}

	const axisColorCandidates = new Map<number, Set<string>>()
	for (const chart of effectiveCharts ?? []) {
		const sourceIndex = chart.yAxisIndex ?? 0
		const index = sourceAxisIndexes ? denseIndexBySource.get(sourceIndex) : sourceIndex
		if (index == null || index > maxIndex) continue
		if (chart.valueSymbol != null && !yAxisIndexToSymbol.has(index)) yAxisIndexToSymbol.set(index, chart.valueSymbol)
		if (chart.color) {
			const colors = axisColorCandidates.get(index) ?? new Set<string>()
			colors.add(chart.color)
			axisColorCandidates.set(index, colors)
		}
	}

	for (const [index, colors] of axisColorCandidates) {
		if (colors.size !== 1) continue
		for (const color of colors) yAxisIndexToExplicitColor.set(index, color)
	}
	for (const [index, colors] of renderedAxisColors) {
		if (colors.size !== 1 || yAxisIndexToExplicitColor.has(index)) continue
		for (const color of colors) yAxisIndexToExplicitColor.set(index, color)
	}

	if (maxIndex < 0) return null

	const isAxisArray = Array.isArray(yAxis)
	const output: Array<MultiSeriesYAxisOption> = []
	const lastOffsetByPosition = new Map<string, number>()
	for (let index = 0; index <= maxIndex; index++) {
		const isPrimary = index === 0
		const sourceIndex = sourceAxisIndexes?.[index] ?? index
		const isPercentageAxis = !!expandTo100Percent && sourceIndex === 0
		const configuredAxis = isAxisArray ? yAxis[sourceIndex] : yAxis
		const baseAxis = configuredAxis ?? (isAxisArray ? yAxis[0] : {}) ?? {}
		const callerAxis = Array.isArray(configuredYAxis)
			? configuredYAxis[sourceIndex]
			: isPrimary
				? configuredYAxis
				: undefined
		const baseAxisLabel =
			baseAxis.axisLabel && typeof baseAxis.axisLabel === 'object' && !Array.isArray(baseAxis.axisLabel)
				? baseAxis.axisLabel
				: {}
		const baseAxisLine =
			baseAxis.axisLine && typeof baseAxis.axisLine === 'object' && !Array.isArray(baseAxis.axisLine)
				? baseAxis.axisLine
				: {}
		const baseAxisLineStyle =
			baseAxisLine.lineStyle && typeof baseAxisLine.lineStyle === 'object' && !Array.isArray(baseAxisLine.lineStyle)
				? baseAxisLine.lineStyle
				: {}
		const callerAxisLabel =
			callerAxis?.axisLabel && typeof callerAxis.axisLabel === 'object' && !Array.isArray(callerAxis.axisLabel)
				? callerAxis.axisLabel
				: {}
		const callerFormatter =
			typeof callerAxisLabel.formatter === 'function' || typeof callerAxisLabel.formatter === 'string'
				? callerAxisLabel.formatter
				: null
		const axisColor = !isPrimary && maxIndex > 0 ? yAxisIndexToExplicitColor.get(index) : undefined
		const axisSymbol = yAxisIndexToSymbol.get(index) ?? valueSymbol
		const position = baseAxis.position ?? (isPrimary ? 'left' : 'right')
		const previousOffset = lastOffsetByPosition.get(position)
		const defaultOffset = previousOffset == null ? 0 : previousOffset + 40
		const offset = typeof baseAxis.offset === 'number' ? baseAxis.offset : defaultOffset

		const axisLineStyle = isPrimary
			? baseAxisLineStyle
			: {
					...baseAxisLineStyle,
					type: [5, 10],
					dashOffset: 5,
					...(axisColor ? { color: axisColor } : {})
				}
		if (!isPrimary) delete axisLineStyle.opacity

		output.push({
			...baseAxis,
			position,
			offset,
			axisLine: {
				...baseAxisLine,
				show: baseAxisLine.show ?? !isPrimary,
				lineStyle: axisLineStyle
			},
			axisLabel: {
				...baseAxisLabel,
				formatter:
					!isPercentageAxis && callerFormatter ? callerFormatter : (value: number) => formatAxisLabel(value, axisSymbol)
			},
			...(isPercentageAxis ? { max: 100, min: 0 } : {})
		})

		lastOffsetByPosition.set(position, Math.max(previousOffset ?? 0, offset))
	}

	return output
}

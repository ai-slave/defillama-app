import type { ScatterChartPoint, ScatterChartValue } from '~/components/ECharts/ScatterChart/types'
import { CHART_COLORS } from '~/constants/colors'

const MAX_COLOR_GROUPS = 7
const MAX_VISIBLE_LABELS = 5
const MIN_SYMBOL_SIZE = 9

export interface ScatterPresentationInput {
	x: number
	y: number
	label?: string
	group?: string
	importance: number
	symbolSize?: number
	valueExtra?: number
}

export interface ScatterPresentationPoint extends ScatterChartPoint {
	value: ScatterChartValue
	seriesName: string
	groupName?: string
	groupColor: string
	showLabel: boolean
	symbolSize: number
	label: { show: boolean }
}

export function buildScatterPresentation(
	points: ScatterPresentationInput[],
	seriesColors: Record<string, string>
): ScatterPresentationPoint[] {
	const groupCounts = new Map<string, number>()
	for (const point of points) {
		if (!point.group) continue
		groupCounts.set(point.group, (groupCounts.get(point.group) ?? 0) + 1)
	}

	const rankedGroups = [...groupCounts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name]) => name)
	const visibleGroups = new Set(
		rankedGroups.length > MAX_COLOR_GROUPS ? rankedGroups.slice(0, MAX_COLOR_GROUPS - 1) : rankedGroups
	)
	const resolvedGroups = rankedGroups.length > MAX_COLOR_GROUPS ? [...visibleGroups, 'Other'] : rankedGroups
	const colorByGroup = new Map(
		resolvedGroups.map((group, index) => [
			group,
			Object.hasOwn(seriesColors, group) ? seriesColors[group] : CHART_COLORS[index % CHART_COLORS.length]
		])
	)

	const topLabels: Array<{ index: number; importance: number }> = []
	for (let index = 0; index < points.length; index++) {
		const point = points[index]
		if (!point.label) continue
		let insertAt = topLabels.length
		while (insertAt > 0 && topLabels[insertAt - 1].importance < point.importance) insertAt--
		topLabels.splice(insertAt, 0, { index, importance: point.importance })
		if (topLabels.length > MAX_VISIBLE_LABELS) topLabels.pop()
	}
	const labeledIndices = new Set(topLabels.map((point) => point.index))

	const output = new Array<ScatterPresentationPoint>(points.length)
	for (let index = 0; index < points.length; index++) {
		const point = points[index]
		const resolvedGroup = point.group ? (visibleGroups.has(point.group) ? point.group : 'Other') : 'Data'
		const showLabel = labeledIndices.has(index)
		const value: ScatterChartValue = [point.x, point.y]
		if (point.label) value.push(point.label)
		if (point.valueExtra != null) {
			if (!point.label) value.push('')
			value.push(point.valueExtra)
		}

		output[index] = {
			value,
			seriesName: resolvedGroup,
			groupName: point.group,
			groupColor:
				colorByGroup.get(resolvedGroup) ??
				(Object.hasOwn(seriesColors, resolvedGroup) ? seriesColors[resolvedGroup] : CHART_COLORS[0]),
			showLabel,
			symbolSize: Math.max(MIN_SYMBOL_SIZE, point.symbolSize ?? 0),
			label: { show: showLabel }
		}
	}
	return output
}

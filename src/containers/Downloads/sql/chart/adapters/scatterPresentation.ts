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

export interface ScatterPresentationPoint {
	value: Array<number | string>
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
		resolvedGroups.map((group, index) => [group, seriesColors[group] ?? CHART_COLORS[index % CHART_COLORS.length]])
	)

	const labeledIndices = new Set(
		points
			.map((point, index) => ({ index, label: point.label, importance: point.importance }))
			.filter((point) => !!point.label)
			.sort((a, b) => b.importance - a.importance || a.index - b.index)
			.slice(0, MAX_VISIBLE_LABELS)
			.map((point) => point.index)
	)

	return points.map((point, index) => {
		const resolvedGroup = point.group ? (visibleGroups.has(point.group) ? point.group : 'Other') : 'Data'
		const showLabel = labeledIndices.has(index)
		const value: Array<number | string> = [point.x, point.y]
		if (point.label) value.push(point.label)
		if (point.valueExtra != null) {
			if (!point.label) value.push('')
			value.push(point.valueExtra)
		}

		return {
			value,
			seriesName: resolvedGroup,
			groupName: point.group,
			groupColor: colorByGroup.get(resolvedGroup) ?? seriesColors[resolvedGroup] ?? CHART_COLORS[0],
			showLabel,
			symbolSize: Math.max(MIN_SYMBOL_SIZE, point.symbolSize ?? 0),
			label: { show: showLabel }
		}
	})
}

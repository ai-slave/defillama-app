export type MetricUnitGroup = 'usd' | 'percent' | 'count' | 'ratio'

const PERCENT_METRIC_TYPES = new Set(['medianApy'])
const COUNT_METRIC_TYPES = new Set(['txs', 'activeUsers', 'newUsers', 'gasUsed'])
const RATIO_METRIC_TYPES = new Set(['pfRatio', 'psRatio'])

export function getMetricUnitGroup(metricType?: string): MetricUnitGroup {
	if (metricType) {
		if (PERCENT_METRIC_TYPES.has(metricType)) return 'percent'
		if (COUNT_METRIC_TYPES.has(metricType)) return 'count'
		if (RATIO_METRIC_TYPES.has(metricType)) return 'ratio'
	}
	return 'usd'
}

export const METRIC_UNIT_GROUP_SYMBOL: Record<MetricUnitGroup, string> = {
	usd: '$',
	percent: '%',
	count: '',
	ratio: ''
}

const MAX_Y_AXES = 3

export interface SeriesAxisInput {
	metricType?: string
	yAxisIndex?: number
}

export interface SeriesAxisLayout {
	needMultipleAxes: boolean
	axisCount: number
	axisUnitGroups: Array<MetricUnitGroup | undefined>
	seriesAxisIndexes: number[]
}

export function resolveSeriesAxisLayout(series: SeriesAxisInput[]): SeriesAxisLayout {
	const distinctUnitGroups: MetricUnitGroup[] = []
	const unitGroupIndex = new Map<MetricUnitGroup, number>()
	const normalizedSeries: Array<{ unitGroup: MetricUnitGroup; yAxisIndex: number | undefined }> = []
	let maxExplicitAxisIndex = 0
	for (const item of series) {
		const group = getMetricUnitGroup(item.metricType)
		normalizedSeries.push({ unitGroup: group, yAxisIndex: item.yAxisIndex })
		if (!unitGroupIndex.has(group)) {
			unitGroupIndex.set(group, distinctUnitGroups.length)
			distinctUnitGroups.push(group)
		}
		if (item.yAxisIndex != null && item.yAxisIndex > maxExplicitAxisIndex) {
			maxExplicitAxisIndex = item.yAxisIndex
		}
	}

	const hasExplicitAxisIndex = maxExplicitAxisIndex > 0
	const needMultipleAxes = distinctUnitGroups.length > 1 || hasExplicitAxisIndex
	const axisCount = needMultipleAxes
		? Math.min(Math.max(distinctUnitGroups.length, maxExplicitAxisIndex + 1, 2), MAX_Y_AXES)
		: 1

	const seriesAxisIndexes: number[] = []
	const axisUnitGroups = new Array<MetricUnitGroup | undefined>(axisCount)
	for (const item of normalizedSeries) {
		const axisIndex = Math.min(Math.max(item.yAxisIndex ?? unitGroupIndex.get(item.unitGroup) ?? 0, 0), MAX_Y_AXES - 1)
		seriesAxisIndexes.push(axisIndex)
		if (axisUnitGroups[axisIndex] === undefined) axisUnitGroups[axisIndex] = item.unitGroup
	}

	return { needMultipleAxes, axisCount, axisUnitGroups, seriesAxisIndexes }
}

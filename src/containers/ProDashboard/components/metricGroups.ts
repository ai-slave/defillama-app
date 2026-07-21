export type MetricUnitGroup = 'usd' | 'percent' | 'count' | 'ratio'

const PERCENT_METRIC_TYPES = new Set(['medianApy'])
const COUNT_METRIC_TYPES = new Set(['txs', 'users', 'activeUsers', 'newUsers', 'gasUsed'])
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
	const seriesUnitGroups = new Array<MetricUnitGroup>(series.length)
	let maxExplicitAxisIndex = 0
	for (let index = 0; index < series.length; index++) {
		const item = series[index]
		const group = getMetricUnitGroup(item.metricType)
		seriesUnitGroups[index] = group
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

	const seriesAxisIndexes = new Array<number>(series.length)
	for (let index = 0; index < series.length; index++) {
		const axisIndex = series[index].yAxisIndex ?? unitGroupIndex.get(seriesUnitGroups[index]) ?? 0
		seriesAxisIndexes[index] = Math.min(Math.max(axisIndex, 0), MAX_Y_AXES - 1)
	}
	const axisUnitGroups = new Array<MetricUnitGroup | undefined>(axisCount)
	for (let index = 0; index < seriesAxisIndexes.length; index++) {
		const axisIndex = seriesAxisIndexes[index]
		axisUnitGroups[axisIndex] ??= seriesUnitGroups[index]
	}

	return { needMultipleAxes, axisCount, axisUnitGroups, seriesAxisIndexes }
}

export type MetricUnitGroup = 'usd' | 'percent' | 'count' | 'ratio'

const PERCENT_METRIC_TYPES = new Set(['medianApy'])
const COUNT_METRIC_TYPES = new Set(['txs', 'activeUsers', 'newUsers'])
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
// Below 1% of the larger series' range, a line is effectively flattened against the baseline.
const SAME_UNIT_AXIS_SPLIT_RATIO = 100

interface AxisMagnitudeRange {
	min: number | undefined
	max: number | undefined
}

function getMagnitudeRatio(magnitude: number, range: AxisMagnitudeRange) {
	if (range.min === undefined || range.max === undefined) return 1
	if (magnitude < range.min) return range.min / magnitude
	if (magnitude > range.max) return magnitude / range.max
	return 1
}

function addMagnitude(ranges: AxisMagnitudeRange[], axisIndex: number, magnitude: number | undefined) {
	if (magnitude === undefined) return
	const range = ranges[axisIndex]
	if (!range) return
	range.min = range.min === undefined ? magnitude : Math.min(range.min, magnitude)
	range.max = range.max === undefined ? magnitude : Math.max(range.max, magnitude)
}

export interface SeriesAxisInput {
	metricType?: string
	yAxisIndex?: number
	/** Maximum absolute displayed value, used to keep a smaller same-unit series visible. */
	magnitude?: number
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
	const normalizedSeries: Array<{
		unitGroup: MetricUnitGroup
		metricType: string | undefined
		yAxisIndex: number | undefined
		magnitude: number | undefined
	}> = []
	let maxExplicitAxisIndex = 0
	for (const item of series) {
		const group = getMetricUnitGroup(item.metricType)
		normalizedSeries.push({
			unitGroup: group,
			metricType: item.metricType,
			yAxisIndex: item.yAxisIndex,
			magnitude:
				typeof item.magnitude === 'number' && Number.isFinite(item.magnitude) && item.magnitude > 0
					? item.magnitude
					: undefined
		})
		if (!unitGroupIndex.has(group)) {
			unitGroupIndex.set(group, distinctUnitGroups.length)
			distinctUnitGroups.push(group)
		}
		if (item.yAxisIndex != null && item.yAxisIndex > maxExplicitAxisIndex) {
			maxExplicitAxisIndex = item.yAxisIndex
		}
	}

	const hasExplicitAxisIndex = maxExplicitAxisIndex > 0
	if (hasExplicitAxisIndex) {
		const axisCount = Math.min(Math.max(distinctUnitGroups.length, maxExplicitAxisIndex + 1, 2), MAX_Y_AXES)
		const seriesAxisIndexes: number[] = []
		const axisUnitGroups = new Array<MetricUnitGroup | undefined>(axisCount)
		for (const item of normalizedSeries) {
			const axisIndex = Math.min(
				Math.max(item.yAxisIndex ?? unitGroupIndex.get(item.unitGroup) ?? 0, 0),
				MAX_Y_AXES - 1
			)
			seriesAxisIndexes.push(axisIndex)
			if (axisUnitGroups[axisIndex] === undefined) axisUnitGroups[axisIndex] = item.unitGroup
		}
		return { needMultipleAxes: true, axisCount, axisUnitGroups, seriesAxisIndexes }
	}

	const axisUnitGroups: Array<MetricUnitGroup | undefined> = distinctUnitGroups.slice(0, MAX_Y_AXES)
	if (axisUnitGroups.length === 0) axisUnitGroups.push(undefined)
	const axisMagnitudeRanges = axisUnitGroups.map(() => ({
		min: undefined as number | undefined,
		max: undefined as number | undefined
	}))
	const metricAxisIndexes = new Map<string, number>()
	const seriesAxisIndexes: number[] = []

	for (const item of normalizedSeries) {
		const fallbackAxisIndex = Math.min(unitGroupIndex.get(item.unitGroup) ?? 0, MAX_Y_AXES - 1)
		const metricKey = `${item.unitGroup}:${item.metricType ?? ''}`
		const existingMetricAxisIndex = metricAxisIndexes.get(metricKey)
		if (existingMetricAxisIndex !== undefined) {
			seriesAxisIndexes.push(existingMetricAxisIndex)
			addMagnitude(axisMagnitudeRanges, existingMetricAxisIndex, item.magnitude)
			continue
		}

		let bestAxisIndex = fallbackAxisIndex
		let bestRatio = Number.POSITIVE_INFINITY
		if (item.magnitude !== undefined) {
			for (let axisIndex = 0; axisIndex < axisUnitGroups.length; axisIndex++) {
				if (axisUnitGroups[axisIndex] !== item.unitGroup) continue
				const range = axisMagnitudeRanges[axisIndex]
				if (!range) continue
				const ratio = getMagnitudeRatio(item.magnitude, range)
				if (ratio < bestRatio) {
					bestRatio = ratio
					bestAxisIndex = axisIndex
				}
			}
		}

		if (item.magnitude !== undefined && bestRatio >= SAME_UNIT_AXIS_SPLIT_RATIO && axisUnitGroups.length < MAX_Y_AXES) {
			bestAxisIndex = axisUnitGroups.length
			axisUnitGroups.push(item.unitGroup)
			axisMagnitudeRanges.push({ min: undefined, max: undefined })
		}

		metricAxisIndexes.set(metricKey, bestAxisIndex)
		seriesAxisIndexes.push(bestAxisIndex)
		addMagnitude(axisMagnitudeRanges, bestAxisIndex, item.magnitude)
	}

	const axisCount = axisUnitGroups.length
	const needMultipleAxes = axisCount > 1
	return { needMultipleAxes, axisCount, axisUnitGroups, seriesAxisIndexes }
}

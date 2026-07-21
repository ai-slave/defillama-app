import {
	buildTimeSeriesChart,
	type PeriodBarSeries,
	type TimePoint
} from '~/components/ECharts/MultiSeriesChart/timeSeriesBuilder'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'

export type ProtocolFlowChartSeries = PeriodBarSeries

/** Normalize stable adapter timestamps once at the server boundary. */
export function normalizeProtocolFlowChart(
	points: readonly (readonly [timestampSec: number, value: number])[],
	trimBeforeFirstPositive = false
): TimePoint[] {
	let startIndex = 0
	if (trimBeforeFirstPositive) {
		const firstPositiveIndex = points.findIndex((point) => point[1] > 0)
		if (firstPositiveIndex !== -1) startIndex = firstPositiveIndex
	}

	const normalized = new Array<TimePoint>(points.length - startIndex)
	for (let index = startIndex; index < points.length; index++) {
		const point = points[index]
		normalized[index - startIndex] = [point[0] * 1e3, point[1]]
	}
	return normalized
}

/** Build selected flow bars or their cumulative line equivalents in one shared pass. */
export function buildProtocolFlowChart({
	groupBy,
	series
}: {
	groupBy: ChartTimeGroupingWithCumulative
	series: readonly ProtocolFlowChartSeries[]
}) {
	return groupBy === 'cumulative'
		? buildTimeSeriesChart({ kind: 'cumulativeLines', series, carryForwardMissingValues: false })
		: buildTimeSeriesChart({ kind: 'periodBars', groupBy, series })
}

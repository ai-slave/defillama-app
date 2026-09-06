import {
	buildTimeSeriesChart,
	type PeriodBarSeries,
	type TimePoint
} from '~/components/ECharts/MultiSeriesChart/timeSeriesBuilder'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'

export type ProtocolFlowChartSeries = PeriodBarSeries

/** Normalize stable adapter timestamps once at the server boundary. */
export function normalizeProtocolFlowChart(
	points: ReadonlyArray<readonly [timestampSec: number, value: number]>,
	trimBeforeFirstPositive = false
): Array<TimePoint> {
	let startIndex = 0
	if (trimBeforeFirstPositive) {
		const firstPositiveIndex = points.findIndex((point) => point[1] > 0)
		if (firstPositiveIndex !== -1) startIndex = firstPositiveIndex
	}

	const normalized = new Array<TimePoint>(points.length - startIndex)
	let sourceIndex = 0
	let normalizedIndex = 0
	for (const point of points) {
		if (sourceIndex++ < startIndex) continue
		normalized[normalizedIndex++] = [point[0] * 1e3, point[1]]
	}
	return normalized
}

/** Build selected flow bars or their cumulative line equivalents in one shared pass. */
export function buildProtocolFlowChart({
	groupBy,
	series
}: {
	groupBy: ChartTimeGroupingWithCumulative
	series: ReadonlyArray<ProtocolFlowChartSeries>
}) {
	return groupBy === 'cumulative'
		? buildTimeSeriesChart({ kind: 'cumulativeLines', series, carryForwardMissingValues: false })
		: buildTimeSeriesChart({ kind: 'periodBars', groupBy, series })
}

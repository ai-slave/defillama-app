import type { LowercaseDwmGrouping } from '~/components/ECharts/ChartGroupingSelector'
import {
	buildTimeSeriesChart,
	type TimePoint,
	type TimeSeriesChartSpec
} from '~/components/ECharts/timeSeriesChartBuilder'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import { CHART_COLORS } from '~/constants/colors'

export type UpcomingUnlockChartProtocol = {
	name: string
	tPrice?: number | null
	events?: Array<{
		timestamp?: number | null
		noOfTokens?: number[] | null
	}> | null
}

export type UpcomingUnlockChartSeries = {
	name: string
	points: TimePoint[]
}

type UpcomingUnlockChartOptions = {
	series: UpcomingUnlockChartSeries[]
	groupBy: LowercaseDwmGrouping
	viewMode: 'Total View' | 'Breakdown View'
}

const TOTAL_SERIES_NAME = 'Total Upcoming Unlock Value'

/** Compact raw unlock events into daily USD points before serializing page props. */
export function buildUpcomingUnlockSeries(
	protocols: UpcomingUnlockChartProtocol[],
	startTimestampSec: number,
	endTimestampSec: number
): UpcomingUnlockChartSeries[] {
	const seriesByName = new Map<string, Map<number, number>>()

	for (const protocol of protocols) {
		const price = protocol.tPrice
		if (!protocol.events || price == null || price <= 0) continue

		let points = seriesByName.get(protocol.name)
		for (const event of protocol.events) {
			const timestampSec = event.timestamp
			if (timestampSec == null) continue
			const dailyTimestampSec = getBucketTimestampSec(timestampSec, 'daily')
			if (dailyTimestampSec < startTimestampSec || dailyTimestampSec >= endTimestampSec) continue
			const tokens = event.noOfTokens
			if (!tokens || tokens.length === 0) continue

			let totalTokens = 0
			for (let i = 0; i < tokens.length; i++) totalTokens += tokens[i] || 0
			if (totalTokens === 0) continue

			const valueUsd = totalTokens * price
			if (valueUsd <= 0) continue
			if (!points) {
				points = new Map<number, number>()
				seriesByName.set(protocol.name, points)
			}
			const timestampMs = dailyTimestampSec * 1e3
			points.set(timestampMs, (points.get(timestampMs) ?? 0) + valueUsd)
		}
	}

	const series: UpcomingUnlockChartSeries[] = []
	for (const [name, points] of seriesByName) series.push({ name, points: Array.from(points.entries()) })
	return series
}

/** Build only the selected chart view from the compact server-provided series. */
export function buildUpcomingUnlockChart({
	series,
	groupBy,
	viewMode
}: UpcomingUnlockChartOptions): TimeSeriesChartSpec {
	if (viewMode === 'Total View') {
		const totalPoints = new Map<number, number>()
		for (const item of series) {
			for (const [timestamp, value] of item.points) {
				totalPoints.set(timestamp, (totalPoints.get(timestamp) ?? 0) + value)
			}
		}
		return buildTimeSeriesChart({
			kind: 'periodBars',
			groupBy,
			series: [
				{
					name: TOTAL_SERIES_NAME,
					color: '#8884d8',
					points: Array.from(totalPoints.entries())
				}
			]
		})
	}

	const sortedSeries = series.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
	return buildTimeSeriesChart({
		kind: 'periodBars',
		groupBy,
		series: sortedSeries.map((item, index) => ({
			name: item.name,
			color: CHART_COLORS[index % CHART_COLORS.length],
			stack: 'A',
			points: item.points
		}))
	})
}

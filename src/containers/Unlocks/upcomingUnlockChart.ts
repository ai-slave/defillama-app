import {
	buildTimeSeriesChart,
	type TimePoint,
	type TimeSeriesChartSpec
} from '~/components/ECharts/MultiSeriesChart/timeSeriesBuilder'
import type { LowercaseDwmGrouping } from '~/components/ECharts/shared/ChartGroupingSelector'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import { chartColor } from '~/constants/colors'
import {
	getCliffEmissionAmount,
	getEmissionAmountBreakdownOverInterval,
	getEmissionAmountOverInterval
} from './eventAmount'
import type { EnrichedProtocolEmission } from './queries'
import type { UpcomingUnlockChartType, UpcomingUnlockChartViewMode } from './upcomingUnlockChartState'

const SECONDS_PER_DAY = 24 * 60 * 60

export type UpcomingUnlockChartProtocol = Pick<EnrichedProtocolEmission, 'name' | 'tPrice' | 'events'>

export type UpcomingUnlockChartSeries = {
	name: string
	cliffPoints: Array<TimePoint>
	linearPoints: Array<TimePoint>
}

export type UpcomingUnlockValueBreakdown = {
	total: number
	cliff: number
	linear: number
	unknownEventCount: number
	missingPriceProtocolCount: number
}

export function calculateUpcomingUnlockStatistics(
	protocols: Array<UpcomingUnlockChartProtocol>,
	nowTimestampSec: number
) {
	const upcomingUnlocks30d = { cliff: 0, linear: 0, unknownEventCount: 0, missingPriceProtocolCount: 0 }
	const upcomingUnlocks7d = { cliff: 0, linear: 0, unknownEventCount: 0, missingPriceProtocolCount: 0 }
	const thirtyDaysLaterTimestampSec = nowTimestampSec + 30 * SECONDS_PER_DAY
	const sevenDaysLaterTimestampSec = nowTimestampSec + 7 * SECONDS_PER_DAY

	for (const protocol of protocols) {
		const amounts30d = getEmissionAmountBreakdownOverInterval(
			protocol.events,
			nowTimestampSec,
			thirtyDaysLaterTimestampSec
		)
		const amounts7d = getEmissionAmountBreakdownOverInterval(
			protocol.events,
			nowTimestampSec,
			sevenDaysLaterTimestampSec
		)
		upcomingUnlocks30d.unknownEventCount += amounts30d.unknownEventCount
		upcomingUnlocks7d.unknownEventCount += amounts7d.unknownEventCount

		const price = protocol.tPrice
		if (price === null || price <= 0) {
			if (amounts30d.total > 0) upcomingUnlocks30d.missingPriceProtocolCount += 1
			if (amounts7d.total > 0) upcomingUnlocks7d.missingPriceProtocolCount += 1
			continue
		}

		upcomingUnlocks30d.cliff += amounts30d.cliff * price
		upcomingUnlocks30d.linear += amounts30d.linear * price
		upcomingUnlocks7d.cliff += amounts7d.cliff * price
		upcomingUnlocks7d.linear += amounts7d.linear * price
	}

	return {
		upcomingUnlocks7d: {
			...upcomingUnlocks7d,
			total: upcomingUnlocks7d.cliff + upcomingUnlocks7d.linear
		},
		upcomingUnlocks30d: {
			...upcomingUnlocks30d,
			total: upcomingUnlocks30d.cliff + upcomingUnlocks30d.linear
		}
	}
}

type UpcomingUnlockChartOptions = {
	series: Array<UpcomingUnlockChartSeries>
	groupBy: LowercaseDwmGrouping
	viewMode: UpcomingUnlockChartViewMode
	unlockType: UpcomingUnlockChartType
}

function getTotalSeriesName(unlockType: UpcomingUnlockChartType) {
	if (unlockType === 'cliff') return 'Upcoming Cliff Unlock Value'
	if (unlockType === 'linear') return 'Upcoming Linear Unlock Value'
	return 'Total Upcoming Unlock Value'
}

/** Compact raw unlock events into daily USD points before serializing page props. */
export function buildUpcomingUnlockSeries(
	protocols: Array<UpcomingUnlockChartProtocol>,
	startTimestampSec: number,
	endTimestampSec: number
): Array<UpcomingUnlockChartSeries> {
	const seriesByName = new Map<string, { cliffPoints: Map<number, number>; linearPoints: Map<number, number> }>()

	for (const protocol of protocols) {
		const price = protocol.tPrice
		if (price === null || price <= 0) continue

		let points = seriesByName.get(protocol.name)
		for (const event of protocol.events) {
			if (event.unlockType === 'cliff') {
				if (event.timestamp < startTimestampSec || event.timestamp >= endTimestampSec) continue
				const dailyTimestampSec = getBucketTimestampSec(event.timestamp, 'daily')
				const totalTokens = getCliffEmissionAmount(event)
				if (totalTokens === null || totalTokens <= 0) continue

				const valueUsd = totalTokens * price
				if (valueUsd <= 0) continue
				if (!points) {
					points = { cliffPoints: new Map(), linearPoints: new Map() }
					seriesByName.set(protocol.name, points)
				}
				const timestampMs = dailyTimestampSec * 1e3
				points.cliffPoints.set(timestampMs, (points.cliffPoints.get(timestampMs) ?? 0) + valueUsd)
				continue
			}

			const eventEndTimestampSec = event.timestamp + event.rateDurationDays * SECONDS_PER_DAY
			const overlapStartTimestampSec = Math.max(event.timestamp, startTimestampSec)
			const overlapEndTimestampSec = Math.min(eventEndTimestampSec, endTimestampSec)
			if (overlapEndTimestampSec <= overlapStartTimestampSec) continue

			let dailyTimestampSec = getBucketTimestampSec(overlapStartTimestampSec, 'daily')
			while (dailyTimestampSec < overlapEndTimestampSec) {
				const totalTokens = getEmissionAmountOverInterval(
					event,
					Math.max(dailyTimestampSec, overlapStartTimestampSec),
					Math.min(dailyTimestampSec + SECONDS_PER_DAY, overlapEndTimestampSec)
				)
				if (totalTokens !== null && totalTokens > 0) {
					const valueUsd = totalTokens * price
					if (valueUsd > 0) {
						if (!points) {
							points = { cliffPoints: new Map(), linearPoints: new Map() }
							seriesByName.set(protocol.name, points)
						}
						const timestampMs = dailyTimestampSec * 1e3
						points.linearPoints.set(timestampMs, (points.linearPoints.get(timestampMs) ?? 0) + valueUsd)
					}
				}
				dailyTimestampSec += SECONDS_PER_DAY
			}
		}
	}

	const series: Array<UpcomingUnlockChartSeries> = []
	for (const [name, points] of seriesByName) {
		series.push({
			name,
			cliffPoints: Array.from(points.cliffPoints.entries()).sort((a, b) => a[0] - b[0]),
			linearPoints: Array.from(points.linearPoints.entries()).sort((a, b) => a[0] - b[0])
		})
	}
	return series
}

function addPoints(totalPoints: Map<number, number>, points: Array<TimePoint>) {
	for (const [timestamp, value] of points) {
		totalPoints.set(timestamp, (totalPoints.get(timestamp) ?? 0) + value)
	}
}

function getPointsForUnlockType(series: UpcomingUnlockChartSeries, unlockType: UpcomingUnlockChartType) {
	if (unlockType === 'cliff') return series.cliffPoints
	if (unlockType === 'linear') return series.linearPoints

	const totalPoints = new Map<number, number>()
	addPoints(totalPoints, series.cliffPoints)
	addPoints(totalPoints, series.linearPoints)
	return Array.from(totalPoints.entries()).sort((a, b) => a[0] - b[0])
}

/** Build only the selected chart view from the compact server-provided series. */
export function buildUpcomingUnlockChart({
	series,
	groupBy,
	viewMode,
	unlockType
}: UpcomingUnlockChartOptions): TimeSeriesChartSpec {
	if (viewMode === 'Total View') {
		const totalPoints = new Map<number, number>()
		for (const item of series) {
			if (unlockType !== 'linear') addPoints(totalPoints, item.cliffPoints)
			if (unlockType !== 'cliff') addPoints(totalPoints, item.linearPoints)
		}
		return buildTimeSeriesChart({
			kind: 'periodBars',
			groupBy,
			series: [
				{
					name: getTotalSeriesName(unlockType),
					color: chartColor(0),
					points: Array.from(totalPoints.entries())
				}
			]
		})
	}

	const sortedSeries = series
		.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.map((item) => ({
			name: item.name,
			points: getPointsForUnlockType(item, unlockType)
		}))
		.filter((item) => item.points.length > 0)
	return buildTimeSeriesChart({
		kind: 'periodBars',
		groupBy,
		series: sortedSeries.map((item, index) => ({
			name: item.name,
			color: chartColor(index),
			stack: 'A',
			points: item.points
		}))
	})
}

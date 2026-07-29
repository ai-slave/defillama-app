import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import type { BridgeVolumePoint } from '~/containers/Bridges/api.types'
import { DAY_MS, getUtcStartOfDay } from '~/utils/timeSeries'
import type { IProtocolOverviewPageData } from './types'

export type IProtocolNumericSeries = Array<[number, number]>
export type IProtocolNullableSeries = Array<[number, number | null]>

export const getGroupedTimestampSec = (timestampSec: number, groupBy: ChartTimeGroupingWithCumulative): number => {
	return groupBy === 'cumulative' ? timestampSec : getBucketTimestampSec(timestampSec, groupBy)
}

export function normalizeChartPointsToMs(
	points: ReadonlyArray<readonly [number, number]> | null | undefined
): IProtocolNumericSeries | null {
	if (!points) return null
	const normalized: IProtocolNumericSeries = []
	for (const [rawTimestamp, value] of points) {
		const timestampMs = rawTimestamp >= 1e12 ? Math.floor(rawTimestamp) : Math.floor(rawTimestamp * 1e3)
		normalized.push([timestampMs, value])
	}

	return normalized.length > 0 ? normalized : null
}

export function normalizeSeriesToSeconds<T extends number | null>(
	series: ReadonlyArray<[number, T]>
): Array<[number, T]> {
	const normalized: Array<[number, T]> = []
	for (const [timestamp, value] of series) {
		normalized.push([timestamp >= 1e12 ? Math.floor(timestamp / 1e3) : Math.floor(timestamp), value])
	}
	return normalized
}

export function normalizeSeriesToMilliseconds<T extends number | null>(
	series: ReadonlyArray<[number, T]>
): Array<[number, T]> {
	const normalized: Array<[number, T]> = []
	for (const [timestamp, value] of series) {
		normalized.push([timestamp >= 1e12 ? Math.floor(timestamp) : Math.floor(timestamp * 1e3), value])
	}
	return normalized
}

export function normalizeBridgeVolumeToChartMs(
	bridgeVolumeData: IProtocolOverviewPageData['bridgeVolume']
): IProtocolNullableSeries | null {
	if (!bridgeVolumeData?.length) return null

	// Match BridgeVolume in index.tsx: sum per-item midpoint volumes for the same date.
	const valuesByTimestamp = new Map<number, number | null>()
	for (const item of bridgeVolumeData) {
		const timestampMs = item.date * 1e3
		const value = item.depositUSD == null || item.withdrawUSD == null ? null : (item.depositUSD + item.withdrawUSD) / 2
		if (!valuesByTimestamp.has(timestampMs)) {
			valuesByTimestamp.set(timestampMs, value)
			continue
		}
		const existing = valuesByTimestamp.get(timestampMs)
		valuesByTimestamp.set(timestampMs, existing == null || value == null ? null : existing + value)
	}

	const chart: IProtocolNullableSeries = []
	for (const [timestampMs, value] of valuesByTimestamp) {
		chart.push([timestampMs, value])
	}

	return chart.length > 0 ? chart : null
}

const BRIDGE_VOLUME_DATA_START_MS = Date.parse('2022-09-01T00:00:00Z')

export interface ProtocolBridgeVolumeMetrics {
	lastCompletedDay: number | null
	sevenCompletedDays: number | null
	thirtyCompletedDays: number | null
	sinceDataStart: number | null
}

/** Build exact completed-UTC-day bridge totals; duplicate rows are additive observations for that day. */
export function getProtocolBridgeVolumeMetrics(
	data: ReadonlyArray<Pick<BridgeVolumePoint, 'date' | 'depositUSD' | 'withdrawUSD'>>,
	currentTimeMs: number = Date.now()
): ProtocolBridgeVolumeMetrics {
	const lastCompletedDayMs = getUtcStartOfDay(currentTimeMs) - DAY_MS
	const volumeByDay = new Map<number, number | null>()
	for (const point of data) {
		const day = getUtcStartOfDay(point.date * 1e3)
		if (day > lastCompletedDayMs) continue
		const volume =
			point.depositUSD == null || point.withdrawUSD == null ? null : (point.depositUSD + point.withdrawUSD) / 2
		const previous = volumeByDay.get(day)
		volumeByDay.set(
			day,
			previous === undefined ? volume : previous == null || volume == null ? null : previous + volume
		)
	}

	const sumWindow = (days: number): number | null => {
		let total = 0
		for (let dayOffset = 0; dayOffset < days; dayOffset++) {
			const value = volumeByDay.get(lastCompletedDayMs - dayOffset * DAY_MS)
			if (value === null) return null
			// Sparse bridge charts omit zero-activity days.
			if (value === undefined) continue
			total += value
		}
		return total
	}

	let sinceDataStart: number | null = null
	if (lastCompletedDayMs >= BRIDGE_VOLUME_DATA_START_MS) {
		let total = 0
		let hasUnknownValue = false
		for (let day = BRIDGE_VOLUME_DATA_START_MS; day <= lastCompletedDayMs; day += DAY_MS) {
			const value = volumeByDay.get(day)
			if (value === null) {
				hasUnknownValue = true
				break
			}
			if (value === undefined) continue
			total += value
		}
		if (!hasUnknownValue) sinceDataStart = total
	}

	return {
		lastCompletedDay: sumWindow(1),
		sevenCompletedDays: sumWindow(7),
		thirtyCompletedDays: sumWindow(30),
		sinceDataStart
	}
}

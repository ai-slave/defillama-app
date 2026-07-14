export const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_TIME_SERIES_TOLERANCE_MS = 2 * 60 * 60 * 1000

type TimestampValue = string | number

export type TimeSeriesLookupOptions = {
	currentTimeMs?: number
	currentDayOffset?: number
	toleranceMs?: number
}

export function toUnixMsTimestamp(timestamp: TimestampValue): number {
	const numericTimestamp = Number(timestamp)
	if (!Number.isFinite(numericTimestamp)) {
		return typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN
	}
	return numericTimestamp > 1e12 ? numericTimestamp : numericTimestamp * 1e3
}

export function getUtcStartOfDay(timestampMs: number): number {
	const date = new Date(timestampMs)
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function findTimeSeriesPointNear<T>(
	series: readonly T[] | null | undefined,
	targetTimestampMs: number,
	getTimestamp: (point: T) => TimestampValue,
	toleranceMs: number = DEFAULT_TIME_SERIES_TOLERANCE_MS
): T | null {
	if (!series?.length || !Number.isFinite(targetTimestampMs)) return null

	let closestPoint: T | null = null
	let closestTimestamp = -Infinity
	let smallestDifference = Infinity

	for (const point of series) {
		const timestamp = toUnixMsTimestamp(getTimestamp(point))
		if (!Number.isFinite(timestamp)) continue
		const difference = Math.abs(timestamp - targetTimestampMs)
		if (difference > toleranceMs) continue
		if (difference < smallestDifference || (difference === smallestDifference && timestamp > closestTimestamp)) {
			closestPoint = point
			closestTimestamp = timestamp
			smallestDifference = difference
		}
	}

	return closestPoint
}

export function getFreshTimeSeriesCurrentPoint<T>(
	series: readonly T[] | null | undefined,
	getTimestamp: (point: T) => TimestampValue,
	options: TimeSeriesLookupOptions = {}
): T | null {
	if (!series?.length) return null

	const currentTimeMs = options.currentTimeMs ?? Date.now()
	const currentDayOffset = options.currentDayOffset ?? 0
	const expectedDayStart = getUtcStartOfDay(currentTimeMs) - currentDayOffset * DAY_MS
	const expectedDayEnd = expectedDayStart + DAY_MS
	let latestPoint: T | null = null
	let latestTimestamp = -Infinity

	for (const point of series) {
		const timestamp = toUnixMsTimestamp(getTimestamp(point))
		if (!Number.isFinite(timestamp) || timestamp < expectedDayStart || timestamp >= expectedDayEnd) continue
		if (timestamp > latestTimestamp) {
			latestPoint = point
			latestTimestamp = timestamp
		}
	}

	return latestPoint
}

export function getTimeSeriesPeriodPair<T>(
	series: readonly T[] | null | undefined,
	daysBefore: number,
	getTimestamp: (point: T) => TimestampValue,
	options: TimeSeriesLookupOptions = {}
): { current: T; previous: T } | null {
	if (!Number.isFinite(daysBefore) || daysBefore <= 0) return null

	const current = getFreshTimeSeriesCurrentPoint(series, getTimestamp, options)
	if (!current) return null

	const currentTimestamp = toUnixMsTimestamp(getTimestamp(current))
	const previous = findTimeSeriesPointNear(
		series,
		currentTimestamp - daysBefore * DAY_MS,
		getTimestamp,
		options.toleranceMs
	)
	if (!previous) return null

	return { current, previous }
}

export function getCompleteTimeSeriesDailyWindow<T>(
	series: readonly T[] | null | undefined,
	days: number,
	getTimestamp: (point: T) => TimestampValue,
	options: TimeSeriesLookupOptions = {}
): T[] | null {
	if (!Number.isInteger(days) || days <= 0) return null

	const current = getFreshTimeSeriesCurrentPoint(series, getTimestamp, options)
	if (!current) return null

	const currentTimestamp = toUnixMsTimestamp(getTimestamp(current))
	const points: T[] = []
	for (let day = 0; day < days; day++) {
		const point = findTimeSeriesPointNear(series, currentTimestamp - day * DAY_MS, getTimestamp, options.toleranceMs)
		if (!point) return null
		points.push(point)
	}

	return points
}

import { firstDayOfMonth, firstDayOfQuarter, firstDayOfYear, lastDayOfWeek } from '~/utils'
import type { ChartTimeGrouping, ChartTimeGroupingWithCumulative } from '../MultiSeriesChart/types'

/**
 * Transform raw time-series tuples into `[timestampMs, value]` pairs for ECharts bar series.
 * Values within the same period are **summed** (appropriate for bar/volume charts).
 * When `groupBy` is `'cumulative'`, a running total is computed across all periods.
 *
 * @param data - Ascending `[date, value]` tuples (date in seconds or ms depending on `dateInMs`).
 * @param groupBy - Temporal bucketing strategy: `'daily'` preserves incoming timestamps,
 *   `'weekly'`/`'monthly'` bucket by week/month end/start, and `'cumulative'` computes a running total.
 * @param dateInMs - When true, incoming dates are already in milliseconds (default: seconds).
 * @param denominationPriceHistory - Optional price map to convert values into an alternative denomination.
 * @returns Chronological `[timestampMs, value | null]` tuples.
 */
type FormatterMode = 'sum' | 'last'

type FormatterInput = {
	data: Array<[string | number, number]>
	groupBy: ChartTimeGroupingWithCumulative
	dateInMs?: boolean
	denominationPriceHistory: Record<string, number> | null
}

export const getBucketTimestampSec = (timestampSec: number, groupBy: ChartTimeGrouping): number => {
	switch (groupBy) {
		case 'daily':
			return Math.floor(timestampSec / 86400) * 86400
		case 'weekly':
			return lastDayOfWeek(timestampSec)
		case 'monthly':
			return firstDayOfMonth(timestampSec)
		case 'quarterly':
			return firstDayOfQuarter(timestampSec)
		case 'yearly':
			return firstDayOfYear(timestampSec)
	}
}

export const getBucketTimestampMs = (timestampMs: number, groupBy: ChartTimeGrouping): number => {
	return getBucketTimestampSec(timestampMs / 1e3, groupBy) * 1e3
}

const formatDailyChart = ({
	data,
	dateInMs = false,
	denominationPriceHistory
}: Pick<FormatterInput, 'data' | 'dateInMs' | 'denominationPriceHistory'>): Array<[number, number | null]> => {
	const formatted = new Array<[number, number | null]>(data.length)
	if (!denominationPriceHistory) {
		for (let i = 0; i < data.length; i++) {
			const point = data[i]
			formatted[i] = [dateInMs ? +point[0] : +point[0] * 1e3, point[1]]
		}
		return formatted
	}

	for (let i = 0; i < data.length; i++) {
		const [date, value] = data[i]
		const timestampSec = dateInMs ? +date / 1e3 : +date
		const timestampMs = dateInMs ? +date : +date * 1e3
		const price = denominationPriceHistory[String(timestampSec)] ?? denominationPriceHistory[String(timestampMs)]
		formatted[i] = [timestampMs, price ? value / price : null]
	}
	return formatted
}

const formatGroupedChart = ({
	data,
	groupBy,
	dateInMs = false,
	denominationPriceHistory,
	mode
}: FormatterInput & { mode: FormatterMode }): Array<[number, number | null]> => {
	if (groupBy === 'daily') {
		return formatDailyChart({ data, dateInMs, denominationPriceHistory })
	}

	if (groupBy === 'cumulative' && mode === 'last') {
		return formatDailyChart({ data, dateInMs, denominationPriceHistory })
	}

	const formatted: Array<[number, number | null]> = []
	let cumulativeTotal = 0

	if (!denominationPriceHistory) {
		for (let i = 0; i < data.length; i++) {
			const point = data[i]
			const timestampMs = dateInMs ? +point[0] : +point[0] * 1e3
			const bucketTimestampMs =
				groupBy === 'cumulative'
					? timestampMs
					: getBucketTimestampSec(dateInMs ? timestampMs / 1e3 : +point[0], groupBy) * 1e3
			const previous = formatted[formatted.length - 1]

			if (mode === 'sum') {
				if (groupBy === 'cumulative') {
					cumulativeTotal += point[1]
					if (previous?.[0] === bucketTimestampMs) previous[1] = cumulativeTotal
					else formatted.push([bucketTimestampMs, cumulativeTotal])
				} else if (previous?.[0] === bucketTimestampMs) {
					previous[1] = (previous[1] ?? 0) + point[1]
				} else {
					formatted.push([bucketTimestampMs, point[1]])
				}
			} else if (previous?.[0] === bucketTimestampMs) {
				previous[1] = point[1]
			} else {
				formatted.push([bucketTimestampMs, point[1]])
			}
		}
		return formatted
	}

	for (let i = 0; i < data.length; i++) {
		const [date, value] = data[i]
		const timestampSec = dateInMs ? +date / 1e3 : +date
		const timestampMs = dateInMs ? +date : +date * 1e3
		const bucketTimestampMs =
			groupBy === 'cumulative' ? timestampMs : getBucketTimestampSec(timestampSec, groupBy) * 1e3
		const price = denominationPriceHistory[String(timestampSec)] ?? denominationPriceHistory[String(timestampMs)]

		if (mode === 'sum') {
			if (!price) continue
			const nextValue = value / price
			const previous = formatted[formatted.length - 1]
			if (groupBy === 'cumulative') {
				cumulativeTotal += nextValue
				if (previous?.[0] === bucketTimestampMs) previous[1] = cumulativeTotal
				else formatted.push([bucketTimestampMs, cumulativeTotal])
			} else if (previous?.[0] === bucketTimestampMs) {
				previous[1] = (previous[1] ?? 0) + nextValue
			} else {
				formatted.push([bucketTimestampMs, nextValue])
			}
			continue
		}

		const nextValue = price ? value / price : null
		const previous = formatted[formatted.length - 1]
		if (previous?.[0] === bucketTimestampMs) {
			previous[1] = nextValue
		} else {
			formatted.push([bucketTimestampMs, nextValue])
		}
	}

	return formatted
}

export const formatBarChart = ({
	data,
	groupBy,
	dateInMs = false,
	denominationPriceHistory
}: FormatterInput): Array<[number, number | null]> =>
	formatGroupedChart({ data, groupBy, dateInMs, denominationPriceHistory, mode: 'sum' })

/**
 * Transform raw time-series tuples into `[timestampMs, value]` pairs for ECharts line series.
 * Unlike {@link formatBarChart}, values within the same period are **not** summed — the last
 * value for each bucket wins (point-in-time snapshot, appropriate for line charts).
 *
 * `'cumulative'` is intentionally not handled here; callers either precompute running totals
 * or reuse `formatBarChart(..., 'cumulative')` and render the result as a line.
 *
 * @param data - Ascending `[date, value]` tuples (date in seconds or ms depending on `dateInMs`).
 * @param groupBy - Temporal bucketing strategy.
 * @param dateInMs - When true, incoming dates are already in milliseconds (default: seconds).
 * @param denominationPriceHistory - Optional price map to convert values into an alternative denomination.
 * @returns Chronological `[timestampMs, value | null]` tuples.
 */
export const formatLineChart = ({
	data,
	groupBy,
	dateInMs = false,
	denominationPriceHistory
}: FormatterInput): Array<[number, number | null]> =>
	formatGroupedChart({ data, groupBy, dateInMs, denominationPriceHistory, mode: 'last' })

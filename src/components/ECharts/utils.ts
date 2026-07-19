import type {
	ChartTimeGrouping,
	ChartTimeGroupingWithCumulative,
	MultiSeriesChart2Dataset
} from '~/components/ECharts/types'
import { firstDayOfMonth, firstDayOfQuarter, firstDayOfYear, lastDayOfWeek, toNiceCsvDate } from '~/utils'
import { createChartRecord, createChartRow } from './dynamicRow'

/** Generate a random 6-digit hex colour string (e.g. `"#a3f04c"`). */
export function stringToColour() {
	return '#' + ((Math.random() * 0xffffff) << 0).toString(16).padStart(6, '0')
}

/** DefiLlama logo watermark for the `graphic` option of canvas charts. */
export function buildWatermarkGraphic(isDark: boolean, height: number = 40) {
	return {
		type: 'image',
		zlevel: 10,
		z: 999,
		silent: true,
		left: 'center',
		top: 'middle',
		style: {
			image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
			width: Math.round((389 / 133) * height),
			height,
			opacity: 0.3
		}
	}
}

const iconValidityCache = new Map<string, boolean | Promise<boolean>>()

/** Returns true if `url` is known to load successfully. Use after `validateIconUrl` resolves. */
export function isIconUrlValid(url: string): boolean {
	return iconValidityCache.get(url) === true
}

/**
 * Probes `url` with an HTMLImageElement and caches the result. Resolves to `true` if the
 * image loaded, `false` on error. Concurrent calls share the same in-flight promise.
 */
export function validateIconUrl(url: string): Promise<boolean> {
	const cached = iconValidityCache.get(url)
	if (cached === true || cached === false) return Promise.resolve(cached)
	if (cached) return cached
	if (typeof Image === 'undefined') return Promise.resolve(false)
	const pending = new Promise<boolean>((resolve) => {
		const img = new Image()
		img.onload = () => {
			iconValidityCache.set(url, true)
			resolve(true)
		}
		img.onerror = () => {
			iconValidityCache.set(url, false)
			resolve(false)
		}
		img.src = url
	})
	iconValidityCache.set(url, pending)
	return pending
}

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

/**
 * Merge multiple named chart series into a single CSV-ready structure.
 * Each row contains a timestamp, a human-readable date, and one column per series.
 * Rows are sorted chronologically by timestamp.
 *
 * @param data - Map of series name → `[timestampMs, value]` tuples.
 * @param filename - Desired filename for the exported CSV.
 * @returns `{ filename, rows }` where rows include a header row followed by data rows.
 */
export function prepareChartCsv(data: Record<string, Array<[string | number, number | null]>>, filename: string) {
	const rows: Array<Array<string | number | null>> = []
	const charts: string[] = []
	const dateStore = createChartRecord<Record<string, number | null>>()
	for (const chartName in data) {
		charts.push(chartName)
		for (const [date, value] of data[chartName]) {
			if (!dateStore[date]) {
				dateStore[date] = createChartRecord<number | null>()
			}
			dateStore[date][chartName] = value
		}
	}
	for (const date in dateStore) {
		const values: Array<number | string | null> = []
		for (const chartName in data) {
			values.push(dateStore[date]?.[chartName] ?? '')
		}
		rows.push([date, toNiceCsvDate(+date / 1000), ...values])
	}

	rows.sort((a, b) => Number(a[0]) - Number(b[0]))
	return { filename, rows: [['Timestamp', 'Date', ...charts], ...rows] }
}

/** Group an ascending canonical dataset without re-sorting or allocating an intermediate Map. */
export function groupMultiSeriesBarChartDataset<TDataset extends MultiSeriesChart2Dataset>({
	dataset,
	groupBy
}: {
	dataset: TDataset
	groupBy: ChartTimeGroupingWithCumulative
}): TDataset {
	if (groupBy === 'daily') return dataset

	const dimensions = dataset.dimensions.filter((dimension) => dimension !== 'timestamp')
	const source: MultiSeriesChart2Dataset['source'] = []

	for (const row of dataset.source) {
		const timestamp = row.timestamp as number
		const bucketTimestamp = groupBy === 'cumulative' ? timestamp : getBucketTimestampMs(timestamp, groupBy)
		let groupedRow = source[source.length - 1]
		if (groupedRow?.timestamp !== bucketTimestamp) groupedRow = undefined

		for (const dimension of dimensions) {
			const value = row[dimension]
			if (value == null) continue
			if (!groupedRow) {
				groupedRow = createChartRow<number | null | undefined>(bucketTimestamp)
				source.push(groupedRow)
			}
			groupedRow[dimension] = ((groupedRow[dimension] as number | undefined) ?? 0) + (value as number)
		}
	}

	if (groupBy === 'cumulative') {
		const cumulativeTotals = new Array<number>(dimensions.length).fill(0)
		for (const row of source) {
			for (let i = 0; i < dimensions.length; i++) {
				const dimension = dimensions[i]
				const value = row[dimension]
				if (value != null) cumulativeTotals[i] += value as number
				row[dimension] = cumulativeTotals[i]
			}
		}
	}

	return {
		...dataset,
		source
	} as TDataset
}

/**
 * Normalize heterogeneous data (object map or array of records) into a sorted
 * `{ name, value }[]` array suitable for ECharts pie/doughnut series.
 * When `limit` is specified, only the top-N slices are kept and the remainder
 * is merged into a single "Others" entry. Existing "Others" entries in the
 * source data are consolidated to avoid duplicates.
 *
 * @param data - Source data as either a `Record<name, value>` or an array of keyed objects.
 * @param sliceIdentifier - Key used to read the slice name from array entries (default `'name'`).
 * @param sliceValue - Key used to read the numeric value from array entries (default `'value'`).
 * @param limit - Maximum number of individual slices before grouping the rest into "Others".
 */
export const preparePieChartData = ({
	data,
	sliceIdentifier = 'name',
	sliceValue = 'value',
	limit
}: {
	data: Record<string, number> | Array<Record<string, any>>
	sliceIdentifier?: string
	sliceValue?: string
	limit?: number
}) => {
	let pieData: Array<{ name: string; value: number }> = []

	if (Array.isArray(data)) {
		pieData = data.map((entry) => {
			return {
				name: entry[sliceIdentifier],
				value: Number(entry[sliceValue])
			}
		})
	} else {
		pieData = Object.entries(data).map(([name, value]) => {
			return {
				name: name,
				value: Number(value)
			}
		})
	}

	pieData.sort((a, b) => b.value - a.value)

	if (!limit) {
		return pieData
	}

	const mainSlices: Array<{ name: string; value: number }> = []
	let othersValue = 0
	for (let i = 0; i < pieData.length; i++) {
		const slice = pieData[i]
		if (i < limit && slice.name !== 'Others') mainSlices.push(slice)
		else othersValue += slice.value
	}

	if (othersValue > 0) {
		mainSlices.push({ name: 'Others', value: othersValue })
	}

	return mainSlices
}

/**
 * Recursively merge `source` into `target`, returning a new object.
 * - Arrays are concatenated (target first, then source).
 * - Nested plain objects are merged recursively.
 * - Primitives and non-object sources overwrite the target value.
 * - `null`/`undefined` sources leave the target unchanged.
 */
export function mergeDeep(target: any, source: any): any {
	if (source == null) return target
	if (Array.isArray(source) && Array.isArray(target)) return [...target, ...source]
	if (typeof source !== 'object') return source
	if (Array.isArray(source)) return source

	const result = { ...target }
	for (const key in source) {
		if (Object.hasOwn(source, key)) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = mergeDeep(target[key] || {}, source[key])
			} else {
				result[key] = source[key]
			}
		}
	}
	return result
}

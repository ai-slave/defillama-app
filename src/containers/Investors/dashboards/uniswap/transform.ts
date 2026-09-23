import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { lastDayOfWeek } from '~/utils'

// Shapes returned by /api/public/uniswap/<tab>. Everything is pre-computed and
// pre-formatted server-side; the frontend renders `formatted` and only uses raw
// `value`/`data` for charts and sorting.

export interface Kpi {
	value: number
	formatted: string
	/** Optional one-line methodology note, surfaced as the KPI's (i) tooltip. */
	note?: string
}

interface ChartSeries {
	name: string
	type?: 'bar' | 'line'
	data: Array<number>
	stack?: string
}

export interface Chart {
	title?: string
	subtitle?: string
	/** Optional one-line methodology note (e.g. the current dynamic majors list). */
	note?: string
	// Drives axis symbol + tooltip: 'usd' renders "$", 'pct' renders "%", counts render none.
	unit?: 'usd' | 'count' | 'pct' | string
	// ISO YYYY-MM-DD for time series, or category labels (chain names, months).
	dates: Array<string>
	series: Array<ChartSeries>
}

export interface Distribution {
	title?: string
	data: Array<{ name: string; value: number; pct: number }>
}

// Generic pre-formatted table (rows hold display strings; `<key>Raw` numbers for sorting).
export interface ApiTableData {
	title?: string
	columns: Array<{ key: string; label: string; align?: 'left' | 'right'; format?: 'text' | 'usd' | 'pct' | 'num' }>
	rows: Array<Record<string, string | number>>
}

export function unitSymbol(unit?: string): string {
	return unit === 'usd' ? '$' : unit === 'pct' ? '%' : ''
}

export function parseDateToUnix(dateStr: string): number {
	if (/^\d+$/.test(dateStr)) {
		const n = parseInt(dateStr, 10)
		return n > 1e12 ? Math.floor(n / 1000) : n
	}
	return Math.floor(Date.parse(dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr) / 1000)
}

// Cumulative series only carry points for days the source actually reported, and ECharts renders
// a missing value inside a stack as a drop to zero. Re-emit every series on the union calendar,
// holding the last running total (0 before a series' first day) so the stack stays continuous.
export function carryForwardCumulative<T extends { points: Array<[number, number]> }>(series: Array<T>): Array<T> {
	const calendar = [...new Set(series.flatMap((s) => s.points.map(([timestamp]) => timestamp)))].sort((a, b) => a - b)
	return series.map((s) => {
		const points: Array<[number, number]> = []
		let cursor = 0
		let total = 0
		for (const timestamp of calendar) {
			while (cursor < s.points.length) {
				const point = s.points[cursor]
				if (point === undefined || point[0] > timestamp) break
				total = point[1]
				cursor += 1
			}
			points.push([timestamp, total])
		}
		return { ...s, points }
	})
}

// Time-chart callers share this broad API type with category charts, so keep date and length guards at this boundary.
export interface TrendSeries {
	name: string
	data: Array<[number, number]>
}

export type Bucket = 'day' | 'week' | 'month' | 'quarter'
export const BUCKET_DAYS: Record<Bucket, number> = { day: 1, week: 7, month: 28, quarter: 90 }

function measureCadence(series: Array<TrendSeries>): Bucket {
	const timestamps = [...new Set(series.flatMap((s) => s.data.map(([timestamp]) => timestamp)))].sort((a, b) => a - b)
	if (timestamps.length < 2) return 'day'
	// Median gap, so a single missing period or a partial first/last bucket can't shift the verdict.
	const gaps = timestamps.slice(1).map((timestamp, index) => (timestamp - timestamps[index]!) / 86_400)
	gaps.sort((a, b) => a - b)
	const median = gaps[Math.floor(gaps.length / 2)]!
	if (median > 45) return 'quarter'
	if (median > 10) return 'month'
	if (median > 1.5) return 'week'
	return 'day'
}

// The finest bucket the payload actually supports, read off its own point spacing: an ir-server
// series can arrive daily, weekly or monthly, and a coarser bucket than the data is a sum of real
// periods while a finer one is a relabeled lie ("Daily" over monthly points). `minBucket` raises
// that floor for series whose finest buckets are too noisy to be worth offering.
export function detectCadence(series: Array<TrendSeries>, minBucket: Bucket = 'day'): Bucket {
	const measured = measureCadence(series)
	return BUCKET_DAYS[minBucket] > BUCKET_DAYS[measured] ? minBucket : measured
}

const CADENCE_GROUP_BY = { day: 'daily', week: 'weekly', month: 'monthly', quarter: 'quarterly' } as const

/**
 * A payload's dataset plus the tooltip grouping its own point spacing supports. Weekly payloads are
 * stamped at the week's Monday (SQL `date_trunc('week')`); each point moves to the Sunday that ends
 * its week, which is the day the shared weekly label reads. Values are never re-summed.
 */
export function chartToPeriodDataset(chart: Chart): {
	dataset: TimestampDataset
	groupBy: (typeof CADENCE_GROUP_BY)[Bucket]
} {
	const dataset = chartToDataset(chart)
	const cadence = detectCadence([{ name: '', data: dataset.source.map((row) => [(row[0] as number) / 1e3, 0]) }])
	if (cadence === 'week') {
		for (const row of dataset.source) row[0] = lastDayOfWeek((row[0] as number) / 1e3) * 1e3
	}
	return { dataset, groupBy: CADENCE_GROUP_BY[cadence] }
}

export function chartToDataset(chart: Chart): TimestampDataset {
	const source: TimestampDataset['source'] = []
	for (const [index, date] of chart.dates.entries()) {
		const timestamp = parseDateToUnix(date) * 1000
		if (!Number.isFinite(timestamp)) continue
		const row: TimestampDataset['source'][number] = [timestamp]
		for (const series of chart.series) {
			const value = series.data[index]
			if (value === undefined) {
				throw new Error(`Expected ${series.name} data for ${date}`)
			}
			row.push(value)
		}
		source.push(row)
	}

	return { source, dimensions: ['timestamp', ...chart.series.map((series) => series.name)] }
}

import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'

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

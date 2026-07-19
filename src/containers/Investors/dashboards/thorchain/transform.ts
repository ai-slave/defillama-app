import { createChartRow } from '~/components/ECharts/dynamicRow'
import type { TimestampDataset } from '~/components/ECharts/timeSeriesDataset'

// Shapes returned by /api/public/thorchain/<fn>. Everything is pre-computed and
// pre-formatted server-side; the frontend renders `formatted` and only uses raw
// `value`/`data` for charts and sorting. See the IR-server API reference.

export interface Kpi {
	value: number
	formatted: string
}

interface ChartSeries {
	name: string
	type?: 'bar' | 'line'
	data: number[]
	stack?: string
}

export interface Chart {
	title?: string
	subtitle?: string
	// Drives axis symbol + tooltip: 'usd' → "$", 'pct' → "%", 'rune'/'count' → none.
	unit?: 'usd' | 'rune' | 'count' | 'pct' | string
	// ISO YYYY-MM-DD for time series, or category labels (chain names, pool assets, months).
	dates: string[]
	series: ChartSeries[]
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

// 'usd' → "$", 'pct' → "%", everything else (rune/count) → no prefix symbol.
export function unitSymbol(unit?: string): string {
	return unit === 'usd' ? '$' : unit === 'pct' ? '%' : ''
}

export function parseDateToUnix(dateStr: string): number {
	if (/^\d+$/.test(dateStr)) {
		const n = parseInt(dateStr, 10)
		return n > 1e12 ? Math.floor(n / 1000) : n
	}
	return Math.floor(Date.parse(dateStr.length === 10 ? dateStr + 'T00:00:00Z' : dateStr) / 1000)
}

// Time-chart callers share this broad API type with category charts, so keep date and length guards at this boundary.
export function chartToDataset(chart: Chart): TimestampDataset {
	const source: TimestampDataset['source'] = []
	for (let i = 0; i < chart.dates.length; i++) {
		const timestamp = parseDateToUnix(chart.dates[i]) * 1000
		if (!Number.isFinite(timestamp)) continue
		const row = createChartRow<number>(timestamp)
		for (let j = 0; j < chart.series.length; j++) {
			const series = chart.series[j]
			row[series.name] = series.data[i] ?? 0
		}
		source.push(row)
	}

	return { source, dimensions: ['timestamp', ...chart.series.map((series) => series.name)] }
}

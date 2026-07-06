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
	return Math.floor(new Date(dateStr.length === 10 ? dateStr + 'T00:00:00Z' : dateStr).getTime() / 1000)
}

// Time charts → [{ date: unix, [seriesName]: value }] for Area/Bar charts.
export function chartToData(chart: Chart | undefined): Array<Record<string, number>> {
	if (!chart?.dates || !chart.series) return []
	return chart.dates.flatMap((dt, i) => {
		const date = parseDateToUnix(dt)
		if (!Number.isFinite(date)) return [] // skip malformed labels rather than emit a NaN-dated point
		const point: Record<string, number> = { date }
		for (const s of chart.series) {
			const v = s.data?.[i]
			point[s.name] = typeof v === 'number' && Number.isFinite(v) ? v : 0
		}
		return [point]
	})
}

// Map each series name to its ECharts stack key (falls back to its own name so
// non-stacked series render side by side rather than stacked).
export function barStacks(chart: Chart): Record<string, string> {
	return Object.fromEntries(chart.series.map((s) => [s.name, s.stack ?? s.name]))
}

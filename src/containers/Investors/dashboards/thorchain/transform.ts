import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'

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

// THORChain counts its native L1 transaction fee — the "network fee", tracked by DefiLlama
// under the `thorchain` chain adapter — as part of total fees, while the thorchain-dex adapter
// explicitly excludes it. So every fees / revenue / protocol-revenue figure here sums both.
export const NETWORK_FEE = 'Network Fee'
export const NETWORK_FEE_NOTE =
	"Includes THORChain's native L1 transaction fee (the network fee), which swap fees exclude; it accrues entirely to the Reserve."

// Pure protocol income: no supply-side cost and no incentives attached, so the network fee
// lands on these three income-statement lines and nowhere else.
const NETWORK_FEE_LINES = ['Gross Protocol Revenue', 'Gross Profit', 'Earnings'] as const
const GROUP_KEYS = ['monthly', 'quarterly', 'yearly', 'cumulative'] as const

type IncomeStatementData = NonNullable<IProtocolOverviewPageData['incomeStatement']>

function periodKeyOf(groupKey: (typeof GROUP_KEYS)[number], unixSeconds: number): string {
	const date = new Date(unixSeconds * 1000)
	const year = date.getUTCFullYear()
	const month = date.getUTCMonth()
	if (groupKey === 'yearly') return String(year)
	if (groupKey === 'quarterly') return `${year}-Q${Math.floor(month / 3) + 1}`
	if (groupKey === 'monthly') return `${year}-${String(month + 1).padStart(2, '0')}`
	return 'cumulative'
}

// Cumulative series only carry points for days the chain actually reported, and ECharts renders
// a missing value inside a stack as a drop to zero. Re-emit every series on the union calendar,
// holding the last running total (0 before a chain's first day) so the stack stays continuous.
export function carryForwardCumulative<T extends { points: Array<[number, number]> }>(series: T[]): T[] {
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

// Sum daily series (already aligned on UTC day timestamps) into one.
export function sumDailySeries(parts: Array<Array<[number, number]>>): Array<[number, number]> {
	const byTimestamp = new Map<number, number>()
	for (const part of parts) {
		for (const [timestamp, value] of part) byTimestamp.set(timestamp, (byTimestamp.get(timestamp) ?? 0) + value)
	}
	return [...byTimestamp].sort((a, b) => a[0] - b[0])
}

// Folds the daily network fee into a thorchain-dex income statement as its own breakdown label,
// so the statement's totals match the dashboard's fee/revenue KPIs.
export function addNetworkFeeToIncomeStatement(
	statement: IncomeStatementData | null | undefined,
	dailyNetworkFees: Array<[number, number]> | undefined
): IncomeStatementData | null | undefined {
	if (!statement?.data || !dailyNetworkFees?.length) return statement
	const merged = structuredClone(statement)
	for (const groupKey of GROUP_KEYS) {
		const group = merged.data[groupKey]
		if (!group) continue
		for (const [timestamp, value] of dailyNetworkFees) {
			if (!value) continue
			// ponytail: fees dated outside the periods the dex statement covers are dropped rather
			// than inventing a period (which needs a synthetic timestamp); revisit if a gap appears.
			const period = group[periodKeyOf(groupKey, timestamp)]
			if (!period) continue
			for (const line of NETWORK_FEE_LINES) {
				const entry = (period.values[line] ??= { value: 0, 'by-label': {} })
				// Lines the upstream statement reports as a bare total carry no `by-label` map.
				entry['by-label'] ??= {}
				entry.value += value
				entry['by-label'][NETWORK_FEE] = (entry['by-label'][NETWORK_FEE] ?? 0) + value
			}
		}
	}
	for (const line of NETWORK_FEE_LINES) {
		const labels = (merged.labelsByType[line] ??= [])
		if (!labels.includes(NETWORK_FEE)) labels.push(NETWORK_FEE)
		if (merged.breakdownMethodology) {
			merged.breakdownMethodology[line] = { ...merged.breakdownMethodology[line], [NETWORK_FEE]: NETWORK_FEE_NOTE }
		}
	}
	return merged
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

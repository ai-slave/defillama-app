import { formatIsoDate } from '~/utils/dateFormat'
import type { ChartTimeGroupingWithCumulative } from '../MultiSeriesChart/types'

const PERIOD_HEADERS: Record<ChartTimeGroupingWithCumulative, Array<string>> = {
	daily: ['Date'],
	cumulative: ['Date'],
	weekly: ['Week start', 'Week end'],
	monthly: ['Month start', 'Month end'],
	quarterly: ['Quarter start', 'Quarter end'],
	yearly: ['Year start', 'Year end']
}

const isoDate = (timestampMs: number) => formatIsoDate(timestampMs, { input: 'milliseconds' })!

/** CSV date columns for a chart grouping. Grouped rows get the start and end date of their period. */
export function getPeriodCsvHeaders(groupBy: ChartTimeGroupingWithCumulative): Array<string> {
	return PERIOD_HEADERS[groupBy]
}

/**
 * ISO date cells for one chart row, matching `getPeriodCsvHeaders` and the tooltip's period label. A
 * weekly timestamp is its week's last day. Any other period is the one containing it, in UTC.
 */
export function getPeriodCsvCells(timestampMs: number, groupBy: ChartTimeGroupingWithCumulative): Array<string> {
	const date = new Date(timestampMs)
	const year = date.getUTCFullYear()
	const month = date.getUTCMonth()
	switch (groupBy) {
		case 'daily':
		case 'cumulative':
			return [isoDate(timestampMs)]
		case 'weekly':
			return [isoDate(timestampMs - 6 * 86_400_000), isoDate(timestampMs)]
		case 'monthly':
			return [isoDate(Date.UTC(year, month, 1)), isoDate(Date.UTC(year, month + 1, 0))]
		case 'quarterly': {
			const quarterStart = Math.floor(month / 3) * 3
			return [isoDate(Date.UTC(year, quarterStart, 1)), isoDate(Date.UTC(year, quarterStart + 3, 0))]
		}
		case 'yearly':
			return [isoDate(Date.UTC(year, 0, 1)), isoDate(Date.UTC(year, 11, 31))]
	}
}

/** Merge named series into one chronological CSV matrix. */
export function prepareChartCsv(
	data: Record<string, Array<[string | number, number | null]>>,
	filename: string,
	groupBy: ChartTimeGroupingWithCumulative
) {
	const rows: Array<Array<string | number | null>> = []
	const charts: Array<string> = []
	const valuesByDate = new Map<string, Map<string, number | null>>()
	for (const [chartName, chartData] of Object.entries(data)) {
		charts.push(chartName)
		for (const [date, value] of chartData) {
			const dateKey = String(date)
			let values = valuesByDate.get(dateKey)
			if (!values) {
				values = new Map()
				valuesByDate.set(dateKey, values)
			}
			values.set(chartName, value)
		}
	}
	for (const [date, valuesByChart] of valuesByDate) {
		const values: Array<number | string | null> = []
		for (const chartName of charts) {
			const value = valuesByChart.get(chartName)
			values.push(value === undefined ? '' : value)
		}
		rows.push([date, ...getPeriodCsvCells(+date, groupBy), ...values])
	}

	rows.sort((a, b) => Number(a[0]) - Number(b[0]))
	return { filename, rows: [['Timestamp', ...getPeriodCsvHeaders(groupBy), ...charts], ...rows] }
}

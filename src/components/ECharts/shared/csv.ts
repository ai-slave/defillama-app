import { formatIsoDate } from '~/utils/dateFormat'

/** Merge named series into one chronological CSV matrix. */
export function prepareChartCsv(data: Record<string, Array<[string | number, number | null]>>, filename: string) {
	const rows: Array<Array<string | number | null>> = []
	const charts: string[] = []
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
		for (const chartName of charts) values.push(valuesByChart.get(chartName) ?? '')
		rows.push([date, formatIsoDate(+date, { input: 'milliseconds' }) ?? '', ...values])
	}

	rows.sort((a, b) => Number(a[0]) - Number(b[0]))
	return { filename, rows: [['Timestamp', 'Date', ...charts], ...rows] }
}

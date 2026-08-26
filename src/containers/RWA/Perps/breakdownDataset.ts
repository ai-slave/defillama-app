import type { RWAChartDataset, RWAChartRow } from '../chartDataset'
import type { IRWAPerpsBreakdownChartResponse } from './api.types'

export function toRWAPerpsBreakdownChartDataset(rows: IRWAPerpsBreakdownChartResponse | null): RWAChartDataset {
	if (!rows || rows.length === 0) return { source: [], dimensions: ['timestamp'] }

	const source: RWAChartDataset['source'] = []
	const latestValueBySeries = new Map<string, number>()

	for (const row of rows) {
		const normalizedRow: RWAChartRow = { timestamp: row.timestamp * 1e3 }
		for (const series in row) {
			if (series === 'timestamp') continue
			const value = row[series]
			normalizedRow[series] = value
			latestValueBySeries.set(series, value ?? 0)
		}
		source.push(normalizedRow)
	}

	const sortedSeries = Array.from(latestValueBySeries.entries())
	sortedSeries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
	const dimensions = ['timestamp']
	for (const [series] of sortedSeries) {
		dimensions.push(series)
	}

	return {
		source,
		dimensions
	}
}

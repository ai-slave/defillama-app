import type { RWAChartDataset, RWAChartRow } from '../chartDataset'
import type { IRWAPerpsBreakdownChartResponse } from './api.types'

export function normalizeRWAPerpsBreakdownChartRows(
	rows: IRWAPerpsBreakdownChartResponse | null
): RWAChartDataset['source'] {
	const normalizedRows: RWAChartDataset['source'] = []

	for (const row of rows ?? []) {
		const normalizedRow: RWAChartRow = {
			timestamp: row.timestamp * 1e3
		}

		for (const key in row) {
			if (key === 'timestamp') continue
			normalizedRow[key] = row[key]
		}

		normalizedRows.push(normalizedRow)
	}

	return normalizedRows
}

export function toRWAPerpsBreakdownChartDataset(rows: IRWAPerpsBreakdownChartResponse | null): RWAChartDataset {
	if (!rows || rows.length === 0) return { source: [], dimensions: ['timestamp'] }

	const source = normalizeRWAPerpsBreakdownChartRows(rows)
	const latestValueBySeries = new Map<string, number>()

	for (const row of source) {
		for (const series in row) {
			if (series === 'timestamp') continue
			latestValueBySeries.set(series, row[series] ?? 0)
		}
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

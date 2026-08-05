import type { IRWABreakdownChartResponse, RWAOverviewBreakdownRequest } from './api.types'
import { getRwaChartTotalLabel, isRwaTotalSeriesLabel } from './chartAggregation'
import type { RWAPositionalChartDataset } from './chartDataset'

export function shouldAppendOverviewBreakdownTotalSeries(breakdown: RWAOverviewBreakdownRequest['breakdown']): boolean {
	return breakdown === 'chain' || breakdown === 'platform' || breakdown === 'assetGroup'
}

export function toOverviewBreakdownChartDataset(
	rows: IRWABreakdownChartResponse | null,
	request: RWAOverviewBreakdownRequest
): RWAPositionalChartDataset {
	return toRwaPositionalChartDataset(
		rows,
		shouldAppendOverviewBreakdownTotalSeries(request.breakdown) ? getRwaChartTotalLabel(request.key) : null
	)
}

export function toRwaPositionalChartDataset(
	rows: IRWABreakdownChartResponse | null,
	totalLabel: string | null = null
): RWAPositionalChartDataset {
	if (!rows || rows.length === 0) return { source: [], dimensions: ['timestamp'] }

	const seenSeries = new Set<string>()
	for (const row of rows) {
		for (const series in row) {
			if (series === 'timestamp' || (totalLabel && (series === 'Total' || isRwaTotalSeriesLabel(series)))) continue
			seenSeries.add(series)
		}
	}

	const seriesDimensions = [...seenSeries]
	const dimensions: RWAPositionalChartDataset['dimensions'] = totalLabel
		? ['timestamp', totalLabel, ...seriesDimensions]
		: ['timestamp', ...seriesDimensions]
	const source: RWAPositionalChartDataset['source'] = []
	for (const input of rows) {
		const output: RWAPositionalChartDataset['source'][number] = [input.timestamp]
		if (totalLabel) {
			let total = 0
			for (const series of seriesDimensions) total += input[series] ?? 0
			output.push(total)
		}
		for (const series of seriesDimensions) {
			output.push(input[series] ?? null)
		}
		source.push(output)
	}

	return { source, dimensions }
}

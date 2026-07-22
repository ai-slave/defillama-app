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

	const appendTotal = totalLabel != null
	const seenSeries = new Set<string>()
	for (const row of rows) {
		for (const series in row) {
			if (series === 'timestamp' || (appendTotal && (series === 'Total' || isRwaTotalSeriesLabel(series)))) continue
			seenSeries.add(series)
		}
	}

	const seriesDimensions = [...seenSeries]
	const dimensions = appendTotal ? ['timestamp', totalLabel, ...seriesDimensions] : ['timestamp', ...seriesDimensions]
	const source = new Array<RWAPositionalChartDataset['source'][number]>(rows.length)
	for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
		const input = rows[rowIndex]
		const output = new Array<number | null>(dimensions.length)
		output[0] = input.timestamp
		let offset = 1
		if (appendTotal) {
			let total = 0
			for (const series of seriesDimensions) total += input[series] ?? 0
			output[1] = total
			offset = 2
		}
		for (let seriesIndex = 0; seriesIndex < seriesDimensions.length; seriesIndex++) {
			output[seriesIndex + offset] = input[seriesDimensions[seriesIndex]] ?? null
		}
		source[rowIndex] = output
	}

	return { source, dimensions }
}

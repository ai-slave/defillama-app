import { getBucketTimestampMs } from '../shared/timeSeries'
import type { ChartTimeGroupingWithCumulative, MultiSeriesTimeSeriesDataset } from './types'

/** Group an ascending canonical bar dataset without re-sorting or allocating a Map. */
export function groupMultiSeriesBarChartDataset({
	dataset,
	groupBy
}: {
	dataset: MultiSeriesTimeSeriesDataset
	groupBy: ChartTimeGroupingWithCumulative
}): MultiSeriesTimeSeriesDataset {
	if (groupBy === 'daily') return dataset

	const source: MultiSeriesTimeSeriesDataset['source'] = []

	for (const row of dataset.source) {
		const timestamp = row[0]
		const bucketTimestamp = groupBy === 'cumulative' ? timestamp : getBucketTimestampMs(timestamp, groupBy)
		let groupedRow = source[source.length - 1]
		if (groupedRow?.[0] !== bucketTimestamp) groupedRow = undefined

		for (let seriesIndex = 1; seriesIndex < dataset.dimensions.length; seriesIndex++) {
			const value = row[seriesIndex]
			if (value == null) continue
			if (!groupedRow) {
				groupedRow = [bucketTimestamp]
				groupedRow.length = dataset.dimensions.length
				source.push(groupedRow)
			}
			groupedRow[seriesIndex] = (groupedRow[seriesIndex] ?? 0) + value
		}
	}

	if (groupBy === 'cumulative') {
		const totals = new Array<number>(dataset.dimensions.length - 1).fill(0)
		for (const row of source) {
			for (let seriesIndex = 1; seriesIndex < dataset.dimensions.length; seriesIndex++) {
				const value = row[seriesIndex]
				const totalIndex = seriesIndex - 1
				if (value != null) totals[totalIndex] = totals[totalIndex]! + value
				row[seriesIndex] = totals[totalIndex]!
			}
		}
	}

	return { ...dataset, source }
}

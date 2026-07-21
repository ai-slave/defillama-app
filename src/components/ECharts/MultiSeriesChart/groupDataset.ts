import { getBucketTimestampMs } from '../shared/timeSeries'
import type { CanonicalMultiSeriesChartDataset, ChartTimeGroupingWithCumulative } from './types'

/** Group an ascending canonical bar dataset without re-sorting or allocating a Map. */
export function groupMultiSeriesBarChartDataset<TDataset extends CanonicalMultiSeriesChartDataset>({
	dataset,
	groupBy
}: {
	dataset: TDataset
	groupBy: ChartTimeGroupingWithCumulative
}): TDataset {
	if (groupBy === 'daily') return dataset

	const timestampIndex = dataset.dimensions.indexOf('timestamp')
	const seriesIndexes: number[] = []
	for (let i = 0; i < dataset.dimensions.length; i++) if (i !== timestampIndex) seriesIndexes.push(i)
	const source: CanonicalMultiSeriesChartDataset['source'] = []

	for (const row of dataset.source) {
		const timestamp = row[timestampIndex] as number
		const bucketTimestamp = groupBy === 'cumulative' ? timestamp : getBucketTimestampMs(timestamp, groupBy)
		let groupedRow = source[source.length - 1]
		if (groupedRow?.[timestampIndex] !== bucketTimestamp) groupedRow = undefined

		for (const seriesIndex of seriesIndexes) {
			const value = row[seriesIndex]
			if (value == null) continue
			if (!groupedRow) {
				groupedRow = new Array<number | null | undefined>(dataset.dimensions.length)
				groupedRow[timestampIndex] = bucketTimestamp
				source.push(groupedRow)
			}
			groupedRow[seriesIndex] = ((groupedRow[seriesIndex] as number | undefined) ?? 0) + (value as number)
		}
	}

	if (groupBy === 'cumulative') {
		const totals = new Array<number>(seriesIndexes.length).fill(0)
		for (const row of source) {
			for (let i = 0; i < seriesIndexes.length; i++) {
				const seriesIndex = seriesIndexes[i]
				const value = row[seriesIndex]
				if (value != null) totals[i] += value as number
				row[seriesIndex] = totals[i]
			}
		}
	}

	return { ...dataset, source } as TDataset
}

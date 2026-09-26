import type { MultiSeriesTimeSeriesDataset, MultiSeriesTimeSeriesRow } from './types'

type ColumnarSeries = {
	name: string
	data: ReadonlyArray<number | null | undefined>
}

type SparseTupleSeries = {
	name: string
	data: ReadonlyArray<readonly [timestamp: number, value: number | null]>
}

export type TimestampDataset = MultiSeriesTimeSeriesDataset

/** Merge independently timed series into one positional dataset; Map output is sorted once chronologically. */
export function buildSparseTimeSeriesDataset(series: ReadonlyArray<SparseTupleSeries>): TimestampDataset {
	const dimensions: TimestampDataset['dimensions'] = ['timestamp', ...series.map((item) => item.name)]
	const rows = new Map<number, MultiSeriesTimeSeriesRow>()
	for (const [seriesIndex, item] of series.entries()) {
		for (const [timestamp, value] of item.data) {
			let row = rows.get(timestamp)
			if (!row) {
				row = [timestamp]
				row.length = series.length + 1
				row.fill(null, 1)
				rows.set(timestamp, row)
			}
			row[seriesIndex + 1] = value
		}
	}
	const source = Array.from(rows.entries())
		.sort(([aTimestamp], [bTimestamp]) => aTimestamp - bTimestamp)
		.map(([, row]) => row)
	return {
		dimensions,
		source
	}
}

/** Build canonical ECharts rows directly from the compact dates + series API shape. */
export function buildColumnarTimeSeriesDataset(
	dates: ReadonlyArray<string>,
	series: ReadonlyArray<ColumnarSeries>,
	toTimestampMs: (date: string) => number,
	missingValue: number | null = null
): TimestampDataset {
	const dimensions: TimestampDataset['dimensions'] = ['timestamp', ...series.map((item) => item.name)]
	const seenNames = new Set<string>()
	for (const { name } of series) {
		if (seenNames.has(name)) throw new Error(`Duplicate series name "${name}" is not allowed`)
		seenNames.add(name)
	}

	const source = new Array<MultiSeriesTimeSeriesRow>(dates.length)

	for (const [dateIndex, date] of dates.entries()) {
		const row: MultiSeriesTimeSeriesRow = [toTimestampMs(date)]
		row.length = series.length + 1
		for (const [seriesIndex, item] of series.entries()) {
			const value = item.data[dateIndex]
			row[seriesIndex + 1] = value ?? missingValue
		}
		source[dateIndex] = row
	}

	return {
		source,
		dimensions
	}
}

/** Build a one-series dataset without first allocating legacy tuple or date-row data. */
export function buildTimeSeriesDataset(
	points: ReadonlyArray<readonly [number, number | null]>,
	valueDimension: string,
	timestampMultiplier: 1 | 1000
): TimestampDataset {
	const source = new Array<MultiSeriesTimeSeriesRow>(points.length)

	for (const [pointIndex, point] of points.entries()) {
		source[pointIndex] = [point[0] * timestampMultiplier, point[1]]
	}

	return { source, dimensions: ['timestamp', valueDimension] }
}

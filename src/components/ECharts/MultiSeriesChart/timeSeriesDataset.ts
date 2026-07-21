import type { CanonicalMultiSeriesChartDataset, MultiSeriesChartArrayRow } from './types'

type ColumnarSeries = {
	name: string
	data: readonly (number | null | undefined)[]
}

export type TimestampDataset = CanonicalMultiSeriesChartDataset

/** Build canonical ECharts rows directly from the compact dates + series API shape. */
export function buildColumnarTimeSeriesDataset(
	dates: readonly string[],
	series: readonly ColumnarSeries[],
	toTimestampMs: (date: string) => number,
	missingValue: number | null = null
): TimestampDataset {
	const dimensions = new Array<string>(series.length + 1)
	dimensions[0] = 'timestamp'
	const seenNames = new Set<string>()
	for (let i = 0; i < series.length; i++) {
		const name = series[i].name
		if (seenNames.has(name)) throw new Error(`Duplicate series name "${name}" is not allowed`)
		seenNames.add(name)
		dimensions[i + 1] = name
	}

	const source = new Array<MultiSeriesChartArrayRow>(dates.length)

	for (let i = 0; i < dates.length; i++) {
		const row = new Array<number | null>(series.length + 1)
		row[0] = toTimestampMs(dates[i])
		for (let j = 0; j < series.length; j++) {
			const value = series[j].data[i]
			row[j + 1] = value ?? missingValue
		}
		source[i] = row
	}

	return {
		source,
		dimensions
	}
}

/** Build a one-series dataset without first allocating legacy tuple or date-row data. */
export function buildTimeSeriesDataset(
	points: readonly (readonly [number, number | null])[],
	valueDimension: string,
	timestampMultiplier: 1 | 1000
): TimestampDataset {
	const source = new Array<MultiSeriesChartArrayRow>(points.length)

	for (let i = 0; i < points.length; i++) {
		const point = points[i]
		source[i] = [point[0] * timestampMultiplier, point[1]]
	}

	return { source, dimensions: ['timestamp', valueDimension] }
}

/** Materialize only the visible dimensions, preserving legacy missing-as-zero behavior. */
export function materializeZeroFilledDataset(
	dataset: TimestampDataset,
	seriesNames: readonly string[]
): TimestampDataset {
	const source = new Array<MultiSeriesChartArrayRow>(dataset.source.length)
	const seriesIndexes = new Array<number>(seriesNames.length)
	for (let i = 0; i < seriesNames.length; i++) seriesIndexes[i] = dataset.dimensions.indexOf(seriesNames[i])
	for (let i = 0; i < dataset.source.length; i++) {
		const input = dataset.source[i]
		const output = new Array<number>(seriesNames.length + 1)
		output[0] = input[0] as number
		for (let j = 0; j < seriesNames.length; j++) {
			output[j + 1] = (input[seriesIndexes[j]] as number | null | undefined) ?? 0
		}
		source[i] = output
	}
	return { source, dimensions: ['timestamp', ...seriesNames] }
}

/** Restrict ascending numeric timestamps by copying row references, not reconstructing rows. */
export function sliceTimestampDataset(
	dataset: TimestampDataset,
	startTimestampMs: number,
	endTimestampMs: number
): TimestampDataset {
	const source = dataset.source
	let low = 0
	let high = source.length

	while (low < high) {
		const middle = (low + high) >>> 1
		if ((source[middle][0] as number) < startTimestampMs) low = middle + 1
		else high = middle
	}
	const startIndex = low

	low = startIndex
	high = source.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if ((source[middle][0] as number) <= endTimestampMs) low = middle + 1
		else high = middle
	}

	if (startIndex === 0 && low === source.length) return dataset
	return { ...dataset, source: source.slice(startIndex, low) }
}

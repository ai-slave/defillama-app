import { createChartRow, setChartRowValue } from './dynamicRow'
import type { MultiSeriesChart2Dataset } from './types'

export type ColumnarSeries = {
	name: string
	data: readonly (number | null | undefined)[]
}

type TimestampRow = Record<string, number | null | undefined> & { timestamp: number }

export type TimestampDataset = Omit<MultiSeriesChart2Dataset, 'source'> & {
	source: TimestampRow[]
}

function assertSeriesDimensionName(name: string) {
	if (name === 'timestamp') throw new Error('"timestamp" is reserved for the x-axis dimension')
}

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
		assertSeriesDimensionName(name)
		if (seenNames.has(name)) throw new Error(`Duplicate series name "${name}" is not allowed`)
		seenNames.add(name)
		dimensions[i + 1] = name
	}

	const source = new Array<TimestampRow>(dates.length)

	for (let i = 0; i < dates.length; i++) {
		const row = createChartRow<number | null | undefined>(toTimestampMs(dates[i]))
		for (let j = 0; j < series.length; j++) {
			const value = series[j].data[i]
			setChartRowValue(row, series[j].name, value ?? missingValue)
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
	assertSeriesDimensionName(valueDimension)
	const source = new Array<TimestampRow>(points.length)

	for (let i = 0; i < points.length; i++) {
		const point = points[i]
		const row = createChartRow<number | null | undefined>(point[0] * timestampMultiplier)
		setChartRowValue(row, valueDimension, point[1])
		source[i] = row
	}

	return { source, dimensions: ['timestamp', valueDimension] }
}

/** Materialize only the visible dimensions, preserving legacy missing-as-zero behavior. */
export function materializeZeroFilledDataset(
	dataset: TimestampDataset,
	seriesNames: readonly string[]
): TimestampDataset {
	const source = new Array<TimestampRow>(dataset.source.length)
	for (let i = 0; i < dataset.source.length; i++) {
		const input = dataset.source[i]
		const output = createChartRow<number | null | undefined>(input.timestamp)
		for (let j = 0; j < seriesNames.length; j++) {
			const name = seriesNames[j]
			setChartRowValue(output, name, input[name] ?? 0)
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
		if (source[middle].timestamp < startTimestampMs) low = middle + 1
		else high = middle
	}
	const startIndex = low

	low = startIndex
	high = source.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if (source[middle].timestamp <= endTimestampMs) low = middle + 1
		else high = middle
	}

	if (startIndex === 0 && low === source.length) return dataset
	return { ...dataset, source: source.slice(startIndex, low) }
}

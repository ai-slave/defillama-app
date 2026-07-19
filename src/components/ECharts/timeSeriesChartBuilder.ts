import { createChartRow } from './dynamicRow'
import type { ChartTimeGrouping, MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from './types'
import { getBucketTimestampMs } from './utils'

/** Canonical millisecond timestamp used by the time-series builder input/output. */
export type TimestampMs = number
/** Normalized chart point as `[timestampMs, value]`. */
export type TimePoint = readonly [timestampMs: TimestampMs, value: number]

/** Multi-series bar input where each series contributes summed values per selected time bucket. */
export type PeriodBarSeries = {
	name: string
	color: string
	stack?: string
	points: readonly TimePoint[]
}

/** Multi-series line input where each series contributes one numeric value per timestamp. */
export type PeriodLineSeries = {
	name: string
	color: string
	points: readonly TimePoint[]
}

/**
 * Canonical multi-series time chart builder input.
 *
 * - `periodBars`: bucket points by `groupBy`, sum values inside each bucket, render bars.
 * - `periodLines`: bucket points by `groupBy`, keep the last value inside each bucket, render lines.
 * - `cumulativeLines`: preserve raw timestamps, sum duplicate timestamps, then apply a running total, render lines.
 */
export type TimeSeriesChartInput =
	| {
			kind: 'periodBars'
			groupBy: ChartTimeGrouping
			series: readonly PeriodBarSeries[]
	  }
	| {
			kind: 'periodLines'
			groupBy: ChartTimeGrouping
			series: readonly PeriodLineSeries[]
	  }
	| {
			kind: 'cumulativeLines'
			series: readonly PeriodLineSeries[]
			carryForwardMissingValues?: boolean
	  }

/** Exact `MultiSeriesChart2` render shape returned by the builder. */
export type TimeSeriesChartSpec = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
}

type TimestampRow = { timestamp: number } & Record<string, number | null | undefined>

const EMPTY_CHART_SPEC: TimeSeriesChartSpec = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: []
}

/** Exhaustiveness guard for future `TimeSeriesChartInput` variants. */
function assertNever(value: never): never {
	throw new Error(`Unhandled time series chart kind: ${JSON.stringify(value)}`)
}

function getOrCreateRow(rowsByTimestamp: Map<number, TimestampRow>, timestamp: number): TimestampRow {
	let row = rowsByTimestamp.get(timestamp)
	if (!row) {
		row = createChartRow<number | null | undefined>(timestamp)
		rowsByTimestamp.set(timestamp, row)
	}
	return row
}

/** Reject ambiguous output while collecting dimensions in input order. */
function addSeriesName(name: string, seenNames: Set<string>, dimensions: string[]) {
	if (name === 'timestamp') throw new Error('"timestamp" is reserved for the x-axis dimension')
	if (seenNames.has(name)) {
		throw new Error(`Duplicate series name "${name}" is not allowed`)
	}
	seenNames.add(name)
	dimensions.push(name)
}

/** Sort the shared sparse rows once, then fill every series value in place. */
function finalizeRows(
	rowsByTimestamp: Map<number, TimestampRow>,
	dimensions: string[],
	isCumulative: boolean,
	carryForwardMissingValues: boolean
): TimestampRow[] {
	const source = Array.from(rowsByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)

	if (isCumulative) {
		const totals = new Array<number>(dimensions.length - 1).fill(0)
		for (const row of source) {
			for (let i = 1; i < dimensions.length; i++) {
				const name = dimensions[i]
				const value = row[name]
				if (value !== undefined) totals[i - 1] += value
				if (value !== undefined || carryForwardMissingValues) row[name] = totals[i - 1]
			}
		}
		return source
	}

	for (const row of source) {
		for (let i = 1; i < dimensions.length; i++) {
			const name = dimensions[i]
			if (row[name] === undefined) row[name] = null
		}
	}
	return source
}

/**
 * Build a complete `MultiSeriesChart2` spec from normalized multi-series time data.
 *
 * Output guarantees:
 * - dense `dataset.source` rows keyed by `timestamp`
 * - one dimension per input series, preserved in input order
 * - one chart config per input series, preserved in input order
 * - missing values filled with `null`, except optional sparse cumulative rows
 *
 * Input requirements:
 * - timestamps are already in milliseconds
 * - `periodLines` points are sorted ascending per series so the last value in each bucket is chronological
 * - values are already normalized to plain numbers
 */
export function buildTimeSeriesChart(input: TimeSeriesChartInput): TimeSeriesChartSpec {
	if (input.series.length === 0) return EMPTY_CHART_SPEC

	const rowsByTimestamp = new Map<number, TimestampRow>()
	const seenNames = new Set<string>()
	const dimensions = ['timestamp']
	const charts = new Array<MultiSeriesChart2SeriesConfig>(input.series.length)

	switch (input.kind) {
		case 'periodBars': {
			for (let i = 0; i < input.series.length; i++) {
				const item = input.series[i]
				addSeriesName(item.name, seenNames, dimensions)
				charts[i] = {
					type: 'bar',
					name: item.name,
					encode: { x: 'timestamp', y: item.name },
					color: item.color,
					...(item.stack ? { stack: item.stack, large: false } : {})
				}
				const points = item.points
				if (points.length === 0) continue

				let bucketTimestamp = getBucketTimestampMs(points[0][0], input.groupBy)
				let bucketValue = points[0][1]
				for (let j = 1; j < points.length; j++) {
					const point = points[j]
					const nextBucketTimestamp = getBucketTimestampMs(point[0], input.groupBy)
					if (nextBucketTimestamp === bucketTimestamp) {
						bucketValue += point[1]
						continue
					}
					const row = getOrCreateRow(rowsByTimestamp, bucketTimestamp)
					row[item.name] = (row[item.name] ?? 0) + bucketValue
					bucketTimestamp = nextBucketTimestamp
					bucketValue = point[1]
				}
				const row = getOrCreateRow(rowsByTimestamp, bucketTimestamp)
				row[item.name] = (row[item.name] ?? 0) + bucketValue
			}
			break
		}
		case 'periodLines': {
			for (let i = 0; i < input.series.length; i++) {
				const item = input.series[i]
				addSeriesName(item.name, seenNames, dimensions)
				charts[i] = {
					type: 'line',
					name: item.name,
					encode: { x: 'timestamp', y: item.name },
					color: item.color
				}
				const points = item.points
				if (points.length === 0) continue

				let bucketTimestamp = getBucketTimestampMs(points[0][0], input.groupBy)
				let bucketValue = points[0][1]
				for (let j = 1; j < points.length; j++) {
					const point = points[j]
					const nextBucketTimestamp = getBucketTimestampMs(point[0], input.groupBy)
					if (nextBucketTimestamp === bucketTimestamp) {
						bucketValue = point[1]
						continue
					}
					getOrCreateRow(rowsByTimestamp, bucketTimestamp)[item.name] = bucketValue
					bucketTimestamp = nextBucketTimestamp
					bucketValue = point[1]
				}
				getOrCreateRow(rowsByTimestamp, bucketTimestamp)[item.name] = bucketValue
			}
			break
		}
		case 'cumulativeLines': {
			for (let i = 0; i < input.series.length; i++) {
				const item = input.series[i]
				addSeriesName(item.name, seenNames, dimensions)
				charts[i] = {
					type: 'line',
					name: item.name,
					encode: { x: 'timestamp', y: item.name },
					color: item.color
				}
				const points = item.points
				if (points.length === 0) continue

				let timestamp = points[0][0]
				let value = points[0][1]
				for (let j = 1; j < points.length; j++) {
					const point = points[j]
					if (point[0] === timestamp) {
						value += point[1]
						continue
					}
					const row = getOrCreateRow(rowsByTimestamp, timestamp)
					row[item.name] = (row[item.name] ?? 0) + value
					timestamp = point[0]
					value = point[1]
				}
				const row = getOrCreateRow(rowsByTimestamp, timestamp)
				row[item.name] = (row[item.name] ?? 0) + value
			}
			break
		}
		default:
			return assertNever(input)
	}

	return {
		dataset: {
			source: finalizeRows(
				rowsByTimestamp,
				dimensions,
				input.kind === 'cumulativeLines',
				input.kind !== 'cumulativeLines' || input.carryForwardMissingValues !== false
			),
			dimensions
		},
		charts
	}
}

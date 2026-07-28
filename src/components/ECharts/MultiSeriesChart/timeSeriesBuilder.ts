import { getBucketTimestampMs } from '../shared/timeSeries'
import type {
	ChartTimeGrouping,
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow
} from './types'

/** Canonical millisecond timestamp used by the time-series builder input/output. */
type TimestampMs = number
/** Normalized chart point as `[timestampMs, value]`. */
export type TimePoint = readonly [timestampMs: TimestampMs, value: number]
type MutableTimeSeriesRow = MultiSeriesTimeSeriesRow

/** Multi-series bar input where each series contributes summed values per selected time bucket. */
export type PeriodBarSeries = {
	name: string
	color: string
	stack?: string
	points: readonly TimePoint[]
}

/** Multi-series line input where each series contributes one numeric value per timestamp. */
type PeriodLineSeries = {
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
type TimeSeriesChartInput =
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

/** Exact `MultiSeriesChart` render shape returned by the builder. */
export type TimeSeriesChartSpec = {
	dataset: MultiSeriesTimeSeriesDataset
	charts: MultiSeriesChartSeriesConfig[]
}

const EMPTY_CHART_SPEC: TimeSeriesChartSpec = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: []
}

/** Exhaustiveness guard for future `TimeSeriesChartInput` variants. */
function assertNever(value: never): never {
	throw new Error(`Unhandled time series chart kind: ${JSON.stringify(value)}`)
}

function getOrCreateRow(
	rowsByTimestamp: Map<number, MutableTimeSeriesRow>,
	timestamp: number,
	seriesCount: number
): MutableTimeSeriesRow {
	let row = rowsByTimestamp.get(timestamp)
	if (!row) {
		row = [timestamp]
		row.length = seriesCount + 1
		rowsByTimestamp.set(timestamp, row)
	}
	return row
}

/** Reject ambiguous output while collecting dimensions in input order. */
function addSeriesName(name: string, seenNames: Set<string>, dimensions: string[]) {
	if (seenNames.has(name)) {
		throw new Error(`Duplicate series name "${name}" is not allowed`)
	}
	seenNames.add(name)
	dimensions.push(name)
}

/** Sort the shared sparse rows once, then fill every series value in place. */
function finalizeRows(
	rowsByTimestamp: Map<number, MutableTimeSeriesRow>,
	seriesCount: number,
	isCumulative: boolean,
	carryForwardMissingValues: boolean
): MultiSeriesTimeSeriesRow[] {
	const source = Array.from(rowsByTimestamp.values()).sort((a, b) => a[0] - b[0])

	if (isCumulative) {
		const totals = new Array<number>(seriesCount).fill(0)
		for (const row of source) {
			for (let i = 1; i <= seriesCount; i++) {
				const value = row[i]
				const totalIndex = i - 1
				if (typeof value === 'number') totals[totalIndex] = totals[totalIndex]! + value
				if (value !== undefined || carryForwardMissingValues) row[i] = totals[totalIndex]!
			}
		}
		return source
	}

	for (const row of source) {
		for (let i = 1; i <= seriesCount; i++) if (row[i] === undefined) row[i] = null
	}
	return source
}

/**
 * Build a complete `MultiSeriesChart` spec from normalized multi-series time data.
 *
 * Output guarantees:
 * - aligned bars and cumulative lines use row-major `dataset.source` rows
 * - independently timed period lines retain per-series positional data
 * - one dimension per input series, preserved in input order
 * - one chart config per input series, preserved in input order
 * - row-major missing values are filled with `null`, except optional sparse cumulative rows
 *
 * Input requirements:
 * - timestamps are already in milliseconds
 * - `periodLines` points are sorted ascending per series so the last value in each bucket is chronological
 * - values are already normalized to plain numbers
 */
export function buildTimeSeriesChart(input: TimeSeriesChartInput): TimeSeriesChartSpec {
	if (input.series.length === 0) return EMPTY_CHART_SPEC

	const rowsByTimestamp = new Map<number, MutableTimeSeriesRow>()
	const seenNames = new Set<string>()
	const dimensions: MultiSeriesTimeSeriesDataset['dimensions'] = ['timestamp']
	const charts = new Array<MultiSeriesChartSeriesConfig>(input.series.length)

	switch (input.kind) {
		case 'periodBars': {
			for (const [seriesIndex, item] of input.series.entries()) {
				const valueIndex = seriesIndex + 1
				addSeriesName(item.name, seenNames, dimensions)
				charts[seriesIndex] = {
					type: 'bar',
					name: item.name,
					encode: { x: 0, y: valueIndex },
					color: item.color,
					...(item.stack ? { stack: item.stack, large: false } : {})
				}
				const points = item.points
				if (points.length === 0) continue

				const firstPoint = points[0]!
				let bucketTimestamp = getBucketTimestampMs(firstPoint[0], input.groupBy)
				let bucketValue = firstPoint[1]
				for (let j = 1; j < points.length; j++) {
					const point = points[j]!
					const nextBucketTimestamp = getBucketTimestampMs(point[0], input.groupBy)
					if (nextBucketTimestamp === bucketTimestamp) {
						bucketValue += point[1]
						continue
					}
					const row = getOrCreateRow(rowsByTimestamp, bucketTimestamp, input.series.length)
					const previousValue = row[valueIndex]
					row[valueIndex] = (typeof previousValue === 'number' ? previousValue : 0) + bucketValue
					bucketTimestamp = nextBucketTimestamp
					bucketValue = point[1]
				}
				const row = getOrCreateRow(rowsByTimestamp, bucketTimestamp, input.series.length)
				const previousValue = row[valueIndex]
				row[valueIndex] = (typeof previousValue === 'number' ? previousValue : 0) + bucketValue
			}
			break
		}
		case 'periodLines': {
			for (const [seriesIndex, item] of input.series.entries()) {
				addSeriesName(item.name, seenNames, dimensions)
				const data: Array<[number, number | null]> = []
				charts[seriesIndex] = {
					type: 'line',
					name: item.name,
					encode: { x: 0, y: 1 },
					color: item.color,
					data
				}
				const points = item.points
				if (points.length === 0) continue

				const firstPoint = points[0]!
				let bucketTimestamp = getBucketTimestampMs(firstPoint[0], input.groupBy)
				let bucketValue = firstPoint[1]
				for (let j = 1; j < points.length; j++) {
					const point = points[j]!
					const nextBucketTimestamp = getBucketTimestampMs(point[0], input.groupBy)
					if (nextBucketTimestamp === bucketTimestamp) {
						bucketValue = point[1]
						continue
					}
					data.push([bucketTimestamp, bucketValue])
					bucketTimestamp = nextBucketTimestamp
					bucketValue = point[1]
				}
				data.push([bucketTimestamp, bucketValue])
			}
			return { dataset: { source: [], dimensions }, charts }
		}
		case 'cumulativeLines': {
			for (const [seriesIndex, item] of input.series.entries()) {
				const valueIndex = seriesIndex + 1
				addSeriesName(item.name, seenNames, dimensions)
				charts[seriesIndex] = {
					type: 'line',
					name: item.name,
					encode: { x: 0, y: valueIndex },
					color: item.color
				}
				const points = item.points
				if (points.length === 0) continue

				const firstPoint = points[0]!
				let timestamp = firstPoint[0]
				let value = firstPoint[1]
				for (let j = 1; j < points.length; j++) {
					const point = points[j]!
					if (point[0] === timestamp) {
						value += point[1]
						continue
					}
					const row = getOrCreateRow(rowsByTimestamp, timestamp, input.series.length)
					const previousValue = row[valueIndex]
					row[valueIndex] = (typeof previousValue === 'number' ? previousValue : 0) + value
					timestamp = point[0]
					value = point[1]
				}
				const row = getOrCreateRow(rowsByTimestamp, timestamp, input.series.length)
				const previousValue = row[valueIndex]
				row[valueIndex] = (typeof previousValue === 'number' ? previousValue : 0) + value
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
				input.series.length,
				input.kind === 'cumulativeLines',
				input.kind !== 'cumulativeLines' || input.carryForwardMissingValues !== false
			),
			dimensions
		},
		charts
	}
}

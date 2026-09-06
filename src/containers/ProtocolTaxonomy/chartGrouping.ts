import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import type { IProtocolTaxonomyPageData, ProtocolTaxonomyChartRow } from './types'

type ProtocolTaxonomyCharts = IProtocolTaxonomyPageData['charts']
type ProtocolTaxonomyGroupedChartsResult = {
	charts: ProtocolTaxonomyCharts
	hasBarCharts: boolean
}

function createGroupedRow(timestamp: number, dimensionCount: number): ProtocolTaxonomyChartRow {
	const row: ProtocolTaxonomyChartRow = [timestamp]
	while (row.length < dimensionCount) row.push(null)
	return row
}

export function buildProtocolTaxonomyGroupedCharts({
	charts,
	groupBy
}: {
	charts: ProtocolTaxonomyCharts
	groupBy: ChartTimeGroupingWithCumulative
}): ProtocolTaxonomyGroupedChartsResult {
	const chartSeries = charts.charts
	if (!chartSeries.some((series) => series.type === 'bar')) return { charts, hasBarCharts: false }

	const dimensionCount = charts.dataset.dimensions.length
	const isCumulative = groupBy === 'cumulative'
	const resolvedSeries: Array<{ type: 'line' | 'bar'; dimensionIndex: number }> = []
	const barDimensionStates: Array<{
		dimensionIndex: number
		total: number
		hasValue: boolean
		unavailable: boolean
	}> = []
	const resolvedBarDimensions = new Set<number>()
	for (const series of chartSeries) {
		const dimensionIndex = series.encode.y
		resolvedSeries.push({ type: series.type, dimensionIndex })
		if (series.type === 'bar' && !resolvedBarDimensions.has(dimensionIndex)) {
			resolvedBarDimensions.add(dimensionIndex)
			barDimensionStates.push({ dimensionIndex, total: 0, hasValue: false, unavailable: false })
		}
	}
	const firstNumericTimestampByDimension = new Array<number | null>(dimensionCount).fill(null)
	for (const inputRow of charts.dataset.source) {
		for (const { dimensionIndex } of barDimensionStates) {
			if (typeof inputRow[dimensionIndex] !== 'number') continue
			const currentFirstTimestamp = firstNumericTimestampByDimension[dimensionIndex] ?? null
			if (currentFirstTimestamp === null || inputRow[0] < currentFirstTimestamp) {
				firstNumericTimestampByDimension[dimensionIndex] = inputRow[0]
			}
		}
	}
	const buckets = new Map<
		number,
		{
			timestamp: number
			row: ProtocolTaxonomyCharts['dataset']['source'][number]
			lineTimestamps: Array<number | null>
			unavailableBarDimensions: Array<number> | null
		}
	>()
	let hasBarCharts = false

	for (const inputRow of charts.dataset.source) {
		const inputTimestamp = inputRow[0]
		const timestamp = isCumulative ? inputTimestamp : getBucketTimestampMs(inputTimestamp, groupBy)
		let bucket = buckets.get(timestamp)
		if (!bucket) {
			bucket = {
				timestamp,
				row: createGroupedRow(timestamp, dimensionCount),
				lineTimestamps: new Array<number | null>(dimensionCount).fill(null),
				unavailableBarDimensions: null
			}
			buckets.set(timestamp, bucket)
		}
		for (const series of resolvedSeries) {
			const { dimensionIndex } = series
			const value = inputRow[dimensionIndex]

			if (series.type === 'bar') {
				if (typeof value !== 'number') {
					const firstNumericTimestamp = firstNumericTimestampByDimension[dimensionIndex] ?? null
					if (firstNumericTimestamp === null || inputTimestamp < firstNumericTimestamp) continue
					const unavailableDimensions = bucket.unavailableBarDimensions ?? []
					if (!unavailableDimensions.includes(dimensionIndex)) unavailableDimensions.push(dimensionIndex)
					bucket.unavailableBarDimensions = unavailableDimensions
					bucket.row[dimensionIndex] = null
					continue
				}
				hasBarCharts = true
				if (bucket.unavailableBarDimensions?.includes(dimensionIndex)) continue
				const currentValue = bucket.row[dimensionIndex]
				bucket.row[dimensionIndex] = (typeof currentValue === 'number' ? currentValue : 0) + value
			} else if ((bucket.lineTimestamps[dimensionIndex] ?? -Infinity) <= inputTimestamp) {
				bucket.row[dimensionIndex] = value ?? null
				bucket.lineTimestamps[dimensionIndex] = inputTimestamp
			}
		}
	}

	if (!hasBarCharts) return { charts, hasBarCharts: false }

	const source = Array.from(buckets.values())
		.sort((a, b) => a.timestamp - b.timestamp)
		.map((bucket) => bucket.row)
	if (isCumulative) {
		for (const row of source) {
			for (const state of barDimensionStates) {
				const value = row[state.dimensionIndex]
				if (typeof value !== 'number') {
					const firstNumericTimestamp = firstNumericTimestampByDimension[state.dimensionIndex] ?? null
					if (firstNumericTimestamp === null || row[0] < firstNumericTimestamp) {
						row[state.dimensionIndex] = null
						continue
					}
					state.unavailable = true
				} else if (!state.unavailable) {
					state.total += value
					state.hasValue = true
				}
				row[state.dimensionIndex] = state.unavailable ? null : state.hasValue ? state.total : null
			}
		}
	}

	return {
		charts: {
			...charts,
			dataset: { source, dimensions: charts.dataset.dimensions },
			charts: chartSeries.map((series) => ({
				...series,
				type: series.type === 'bar' && isCumulative ? 'line' : series.type
			}))
		},
		hasBarCharts: true
	}
}

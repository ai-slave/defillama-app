import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import type { IProtocolTaxonomyPageData } from './types'

type ProtocolTaxonomyCharts = IProtocolTaxonomyPageData['charts']
type ProtocolTaxonomyGroupedChartsResult = {
	charts: ProtocolTaxonomyCharts
	hasBarCharts: boolean
}

function getYDimensionIndex(series: MultiSeriesChartSeriesConfig, dimensions: string[]): number {
	const encodedY = Array.isArray(series.encode.y) ? series.encode.y[0] : series.encode.y
	return typeof encodedY === 'number' ? encodedY : dimensions.indexOf(encodedY)
}

export function buildProtocolTaxonomyGroupedCharts({
	charts,
	groupBy
}: {
	charts: ProtocolTaxonomyCharts
	groupBy: ChartTimeGroupingWithCumulative
}): ProtocolTaxonomyGroupedChartsResult {
	const chartSeries = charts.charts ?? []
	if (!chartSeries.some((series) => series.type === 'bar')) return { charts, hasBarCharts: false }

	const dimensionCount = charts.dataset.dimensions.length
	const cumulativeTotals = new Array<number>(dimensionCount).fill(0)
	const hasCumulativeValue = new Array<boolean>(dimensionCount).fill(false)
	const source: ProtocolTaxonomyCharts['dataset']['source'] = []
	const isCumulative = groupBy === 'cumulative'
	const barDimensionIndexes: number[] = []
	for (const series of chartSeries) {
		if (series.type !== 'bar') continue
		const dimensionIndex = getYDimensionIndex(series, charts.dataset.dimensions)
		if (dimensionIndex >= 0) barDimensionIndexes.push(dimensionIndex)
	}
	let hasBarCharts = false

	for (const inputRow of charts.dataset.source) {
		const inputTimestamp = inputRow[0]
		if (typeof inputTimestamp !== 'number') continue
		const timestamp = isCumulative ? inputTimestamp : getBucketTimestampMs(inputTimestamp, groupBy)
		let outputRow = source[source.length - 1]

		for (const series of chartSeries) {
			const dimensionIndex = getYDimensionIndex(series, charts.dataset.dimensions)
			if (dimensionIndex < 0) continue
			const value = inputRow[dimensionIndex]
			if (typeof value !== 'number') continue

			if (outputRow?.[0] !== timestamp) {
				outputRow = new Array(dimensionCount).fill(null)
				outputRow[0] = timestamp
				source.push(outputRow)
			}

			if (series.type === 'bar') {
				hasBarCharts = true
				if (isCumulative) {
					cumulativeTotals[dimensionIndex] += value
					hasCumulativeValue[dimensionIndex] = true
					outputRow[dimensionIndex] = cumulativeTotals[dimensionIndex]
				} else {
					outputRow[dimensionIndex] = ((outputRow[dimensionIndex] as number | null) ?? 0) + value
				}
			} else {
				outputRow[dimensionIndex] = value
			}
		}
		if (isCumulative && outputRow?.[0] === timestamp) {
			for (const dimensionIndex of barDimensionIndexes) {
				if (hasCumulativeValue[dimensionIndex] && outputRow[dimensionIndex] == null) {
					outputRow[dimensionIndex] = cumulativeTotals[dimensionIndex]
				}
			}
		}
	}

	if (!hasBarCharts) return { charts, hasBarCharts: false }

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

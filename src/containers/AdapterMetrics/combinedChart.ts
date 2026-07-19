import type { LowercaseDwmcGrouping } from '~/components/ECharts/ChartGroupingSelector'
import { createChartRow } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { getBucketTimestampMs } from '~/components/ECharts/utils'
import { CHART_COLORS } from '~/constants/colors'
import { LINE_DIMENSIONS } from './constants'

export type CombinedChartPresentation = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
}

type SeriesDefinition = {
	dimension: string
	isSnapshotMetric: boolean
	type: 'line' | 'bar'
	color: string
}

function getCombinedChartSeriesConfig(series: SeriesDefinition, index: number): MultiSeriesChart2SeriesConfig {
	return {
		type: series.type,
		name: series.dimension,
		encode: { x: 'timestamp', y: series.dimension },
		color: series.color,
		...(index > 0 && series.type === 'line' ? { yAxisIndex: 1, hideAreaStyle: true } : {})
	}
}

export function buildAdapterByChainCombinedChartPresentation({
	chartData,
	chartName,
	groupBy
}: {
	chartData: MultiSeriesChart2Dataset
	chartName: string
	groupBy: LowercaseDwmcGrouping
}): CombinedChartPresentation {
	const dimensions: string[] = []
	for (const dimension of chartData.dimensions) {
		if (dimension !== 'timestamp') dimensions.push(dimension)
	}

	const isCumulative = groupBy === 'cumulative'
	const isSnapshotChart = LINE_DIMENSIONS.has(chartName)
	const seriesDefinitions: SeriesDefinition[] = []
	for (let index = 0; index < dimensions.length; index++) {
		const dimension = dimensions[index]
		const isSnapshotMetric = isSnapshotChart || LINE_DIMENSIONS.has(dimension)
		seriesDefinitions.push({
			dimension,
			isSnapshotMetric,
			type: isSnapshotMetric || isCumulative ? 'line' : 'bar',
			color: CHART_COLORS[index % CHART_COLORS.length]
		})
	}

	const charts: MultiSeriesChart2SeriesConfig[] = []
	for (let index = 0; index < seriesDefinitions.length; index++) {
		charts.push(getCombinedChartSeriesConfig(seriesDefinitions[index], index))
	}

	if (groupBy === 'daily') {
		return { dataset: chartData, charts }
	}

	const rowsByTimestamp = new Map<number, MultiSeriesChart2Dataset['source'][number]>()
	for (const sourceRow of chartData.source) {
		const timestamp = sourceRow.timestamp as number
		const bucketTimestamp = isCumulative ? timestamp : getBucketTimestampMs(timestamp, groupBy)
		let bucketRow = rowsByTimestamp.get(bucketTimestamp)

		for (const series of seriesDefinitions) {
			const value = sourceRow[series.dimension]
			if (value == null) continue

			if (!bucketRow) {
				bucketRow = createChartRow<number | null>(bucketTimestamp)
				rowsByTimestamp.set(bucketTimestamp, bucketRow)
			}

			// Snapshot series keep the last observation in a bucket; flow series add every observation.
			bucketRow[series.dimension] = series.isSnapshotMetric
				? value
				: ((bucketRow[series.dimension] as number | undefined) ?? 0) + (value as number)
		}
	}

	const groupedRows = Array.from(rowsByTimestamp.values())

	if (isCumulative) {
		const cumulativeTotals = new Array<number>(seriesDefinitions.length).fill(0)
		for (const row of groupedRows) {
			for (let index = 0; index < seriesDefinitions.length; index++) {
				const series = seriesDefinitions[index]
				if (series.isSnapshotMetric) continue

				const value = row[series.dimension]
				if (value == null) continue
				cumulativeTotals[index] += value as number
				row[series.dimension] = cumulativeTotals[index]
			}
		}
	}

	const source: MultiSeriesChart2Dataset['source'] = []
	for (const row of groupedRows) {
		const denseRow = createChartRow<number | null>(row.timestamp as number)
		for (const series of seriesDefinitions) {
			denseRow[series.dimension] = (row[series.dimension] as number | null | undefined) ?? null
		}
		source.push(denseRow)
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...dimensions] },
		charts
	}
}

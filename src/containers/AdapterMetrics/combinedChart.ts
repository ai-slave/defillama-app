import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { LowercaseDwmcGrouping } from '~/components/ECharts/shared/ChartGroupingSelector'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { CHART_COLORS } from '~/constants/colors'
import { LINE_DIMENSIONS } from './constants'

export type CombinedChartPresentation = {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
}

type SeriesDefinition = {
	dimension: string
	isSnapshotMetric: boolean
	type: 'line' | 'bar'
	color: string
}

function getCombinedChartSeriesConfig(series: SeriesDefinition, index: number): MultiSeriesChartSeriesConfig {
	return {
		type: series.type,
		name: series.dimension,
		encode: { x: 0, y: index + 1 },
		color: series.color,
		...(index > 0 && series.type === 'line' ? { yAxisIndex: 1, hideAreaStyle: true } : {})
	}
}

export function buildAdapterByChainCombinedChartPresentation({
	chartData,
	chartName,
	groupBy
}: {
	chartData: MultiSeriesChartDataset
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

	const charts: MultiSeriesChartSeriesConfig[] = []
	for (let index = 0; index < seriesDefinitions.length; index++) {
		charts.push(getCombinedChartSeriesConfig(seriesDefinitions[index], index))
	}

	if (groupBy === 'daily') {
		return { dataset: chartData, charts }
	}

	const rowsByTimestamp = new Map<number, MultiSeriesChartDataset['source'][number]>()
	for (const sourceRow of chartData.source) {
		const timestamp = sourceRow[0] as number
		const bucketTimestamp = isCumulative ? timestamp : getBucketTimestampMs(timestamp, groupBy)
		let bucketRow = rowsByTimestamp.get(bucketTimestamp)

		for (let seriesIndex = 0; seriesIndex < seriesDefinitions.length; seriesIndex++) {
			const series = seriesDefinitions[seriesIndex]
			const value = sourceRow[seriesIndex + 1]
			if (value == null) continue

			if (!bucketRow) {
				bucketRow = new Array<number | null>(seriesDefinitions.length + 1).fill(null)
				bucketRow[0] = bucketTimestamp
				rowsByTimestamp.set(bucketTimestamp, bucketRow)
			}

			// Snapshot series keep the last observation in a bucket; flow series add every observation.
			bucketRow[seriesIndex + 1] = series.isSnapshotMetric
				? value
				: ((bucketRow[seriesIndex + 1] as number | undefined) ?? 0) + (value as number)
		}
	}

	const groupedRows = Array.from(rowsByTimestamp.values())

	if (isCumulative) {
		const cumulativeTotals = new Array<number>(seriesDefinitions.length).fill(0)
		for (const row of groupedRows) {
			for (let index = 0; index < seriesDefinitions.length; index++) {
				const series = seriesDefinitions[index]
				if (series.isSnapshotMetric) continue

				const value = row[index + 1]
				if (value == null) continue
				cumulativeTotals[index] += value as number
				row[index + 1] = cumulativeTotals[index]
			}
		}
	}

	return {
		dataset: { source: groupedRows, dimensions: ['timestamp', ...dimensions] },
		charts
	}
}

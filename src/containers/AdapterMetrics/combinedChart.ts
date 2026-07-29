import type {
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow
} from '~/components/ECharts/MultiSeriesChart/types'
import type { LowercaseDwmcGrouping } from '~/components/ECharts/shared/ChartGroupingSelector'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { CHART_COLORS } from '~/constants/colors'
import { LINE_DIMENSIONS } from './constants'

export type CombinedChartPresentation = {
	dataset: MultiSeriesTimeSeriesDataset
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

function getChartColor(index: number): string {
	const color = CHART_COLORS[index % CHART_COLORS.length]
	if (color === undefined) throw new Error(`Chart palette is missing color ${index}`)
	return color
}

export function buildAdapterByChainCombinedChartPresentation({
	chartData,
	chartName,
	groupBy
}: {
	chartData: MultiSeriesTimeSeriesDataset
	chartName: string
	groupBy: LowercaseDwmcGrouping
}): CombinedChartPresentation {
	const dimensions = chartData.dimensions.slice(1)

	const isCumulative = groupBy === 'cumulative'
	const isSnapshotChart = LINE_DIMENSIONS.has(chartName)
	const seriesDefinitions: SeriesDefinition[] = []
	for (let index = 0; index < dimensions.length; index++) {
		const dimension = dimensions[index]
		if (dimension === undefined) continue
		const isSnapshotMetric = isSnapshotChart || LINE_DIMENSIONS.has(dimension)
		seriesDefinitions.push({
			dimension,
			isSnapshotMetric,
			type: isSnapshotMetric || isCumulative ? 'line' : 'bar',
			color: getChartColor(index)
		})
	}

	const charts: MultiSeriesChartSeriesConfig[] = []
	for (let index = 0; index < seriesDefinitions.length; index++) {
		const series = seriesDefinitions[index]
		if (series === undefined) continue
		charts.push(getCombinedChartSeriesConfig(series, index))
	}

	if (groupBy === 'daily') {
		return { dataset: chartData, charts }
	}

	const rowsByTimestamp = new Map<number, MultiSeriesTimeSeriesRow>()
	for (const sourceRow of chartData.source) {
		const timestamp = sourceRow[0]
		const bucketTimestamp = isCumulative ? timestamp : getBucketTimestampMs(timestamp, groupBy)
		let bucketRow = rowsByTimestamp.get(bucketTimestamp)

		for (let seriesIndex = 0; seriesIndex < seriesDefinitions.length; seriesIndex++) {
			const series = seriesDefinitions[seriesIndex]
			if (!series) continue
			const value = sourceRow[seriesIndex + 1]
			if (value == null) continue

			if (!bucketRow) {
				bucketRow = [bucketTimestamp]
				for (let index = 0; index < seriesDefinitions.length; index++) bucketRow.push(null)
				rowsByTimestamp.set(bucketTimestamp, bucketRow)
			}

			// Snapshot series keep the last observation in a bucket; flow series add every observation.
			bucketRow[seriesIndex + 1] = series.isSnapshotMetric ? value : (bucketRow[seriesIndex + 1] ?? 0) + value
		}
	}

	const groupedRows = Array.from(rowsByTimestamp.values())

	if (isCumulative) {
		const cumulativeTotals = new Array<number>(seriesDefinitions.length).fill(0)
		const hasCumulativeValue = new Array<boolean>(seriesDefinitions.length).fill(false)
		for (const row of groupedRows) {
			for (let index = 0; index < seriesDefinitions.length; index++) {
				const series = seriesDefinitions[index]
				if (!series) continue
				if (series.isSnapshotMetric) continue

				const value = row[index + 1]
				if (value == null) {
					if (hasCumulativeValue[index]) row[index + 1] = cumulativeTotals[index]
					continue
				}
				cumulativeTotals[index] = (cumulativeTotals[index] ?? 0) + value
				hasCumulativeValue[index] = true
				row[index + 1] = cumulativeTotals[index] ?? 0
			}
		}
	}

	return {
		dataset: { source: groupedRows, dimensions: ['timestamp', ...dimensions] },
		charts
	}
}

import { createChartRow, setChartRowValue } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import type { ChartSeries } from '~/utils/breakdowns'
import type { DashboardGrouping } from '../types'
import { getGroupedTimestampSec } from '../utils'

export type ChartBuilderChartType = 'stackedBar' | 'stackedArea' | 'line'

const SNAPSHOT_METRICS = new Set(['tvl', 'stablecoins', 'open-interest'])

export const isChartBuilderSnapshotMetric = (metric: string): boolean => SNAPSHOT_METRICS.has(metric)

export type ChartBuilderSeriesView = {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
	seriesNames: string[]
}

/**
 * Convert the ascending column-series API contract directly into ECharts rows.
 * Snapshot metrics keep the last value in grouped periods; flow metrics sum them.
 */
export function buildChartBuilderSeriesView({
	series,
	grouping = 'day',
	useLastValue,
	displayAs,
	chartType,
	resolveColor
}: {
	series: ChartSeries[]
	grouping?: DashboardGrouping
	useLastValue: boolean
	displayAs: 'timeSeries' | 'percentage'
	chartType: ChartBuilderChartType
	resolveColor: (name: string, fallback?: string) => string
}): ChartBuilderSeriesView {
	const seriesNames = new Array<string>(series.length)
	const dataDimensions = new Array<string>(series.length)
	const dimensions = new Array<string>(series.length + 1)
	const charts = new Array<MultiSeriesChart2SeriesConfig>(series.length)
	dimensions[0] = 'timestamp'

	const type = chartType === 'stackedBar' ? 'bar' : 'line'
	const stack = chartType === 'stackedBar' || chartType === 'stackedArea' ? 'total' : undefined
	for (let i = 0; i < series.length; i++) {
		const item = series[i]
		// API names remain display identities; internal dimensions avoid collisions
		// with the reserved timestamp field and JavaScript object prototype keys.
		const dataDimension = `series-${i}`
		seriesNames[i] = item.name
		dataDimensions[i] = dataDimension
		dimensions[i + 1] = dataDimension
		charts[i] = {
			type,
			name: item.name,
			encode: { x: 'timestamp', y: dataDimension },
			color: resolveColor(item.name, item.color),
			...(stack ? { stack } : {})
		}
	}

	// Every chart-builder route aligns the final top-series/Others response to one
	// ascending timestamp vector. Walk that vector once so grouping work is shared.
	const inputRowCount = series[0]?.data.length ?? 0
	const source: MultiSeriesChart2Dataset['source'] = []
	let row: Record<string, number> | null = null
	let groupedTimestamp = -1
	const pushRow = () => {
		if (!row) return
		if (displayAs === 'percentage') {
			let total = 0
			for (let i = 0; i < dataDimensions.length; i++) total += row[dataDimensions[i]]
			for (let i = 0; i < dataDimensions.length; i++) {
				const dimension = dataDimensions[i]
				setChartRowValue(row, dimension, total > 0 ? (row[dimension] / total) * 100 : 0)
			}
		}
		source.push(row)
	}

	for (let pointIndex = 0; pointIndex < inputRowCount; pointIndex++) {
		const timestamp = series[0].data[pointIndex][0]
		const nextGroupedTimestamp = grouping === 'day' ? timestamp : getGroupedTimestampSec(timestamp, grouping)
		if (!row || nextGroupedTimestamp !== groupedTimestamp) {
			pushRow()
			groupedTimestamp = nextGroupedTimestamp
			row = createChartRow<number>(groupedTimestamp * 1e3)
			for (let i = 0; i < series.length; i++) {
				setChartRowValue(row, dataDimensions[i], series[i].data[pointIndex][1])
			}
			continue
		}

		for (let i = 0; i < series.length; i++) {
			const dimension = dataDimensions[i]
			const value = series[i].data[pointIndex][1]
			setChartRowValue(row, dimension, useLastValue ? value : row[dimension] + value)
		}
	}
	pushRow()

	return { dataset: { source, dimensions }, charts, seriesNames }
}

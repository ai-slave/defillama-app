import type {
	CanonicalMultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import type { ChartSeries } from '~/utils/breakdowns'
import type { CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import { filterDataByTimePeriod } from '../queries'
import type { DashboardGrouping } from '../types'
import { getGroupedTimestampSec } from '../utils'

export type ChartBuilderChartType = 'stackedBar' | 'stackedArea' | 'line'

const SNAPSHOT_METRICS = new Set(['tvl', 'stablecoins', 'open-interest'])

export const isChartBuilderSnapshotMetric = (metric: string): boolean => SNAPSHOT_METRICS.has(metric)

export type ChartBuilderSeriesView = {
	dataset: CanonicalMultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	seriesNames: Array<string>
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
	series: Array<ChartSeries>
	grouping?: DashboardGrouping
	useLastValue: boolean
	displayAs: 'timeSeries' | 'percentage'
	chartType: ChartBuilderChartType
	resolveColor: (name: string, fallback?: string) => string
}): ChartBuilderSeriesView {
	const seriesNames = new Array<string>(series.length)
	const dimensions = new Array<string>(series.length + 1)
	const charts = new Array<MultiSeriesChartSeriesConfig>(series.length)
	dimensions[0] = 'timestamp'

	const type = chartType === 'stackedBar' ? 'bar' : 'line'
	const stack = chartType === 'stackedBar' || chartType === 'stackedArea' ? 'total' : undefined
	for (let i = 0; i < series.length; i++) {
		const item = series[i]
		// API names are display/export metadata; numeric encodes address positional rows.
		seriesNames[i] = item.name
		dimensions[i + 1] = item.name
		charts[i] = {
			type,
			name: item.name,
			encode: { x: 0, y: i + 1 },
			color: resolveColor(item.name, item.color),
			...(stack ? { stack } : {})
		}
	}

	// Every chart-builder route aligns the final top-series/Others response to one
	// ascending timestamp vector. Walk that vector once so grouping work is shared.
	const inputRowCount = series[0]?.data.length ?? 0
	const source: Array<Array<number>> = []
	let row: Array<number> | null = null
	let groupedTimestamp = -1
	const pushRow = () => {
		if (!row) return
		if (displayAs === 'percentage') {
			let total = 0
			for (let i = 1; i < row.length; i++) total += row[i]
			for (let i = 1; i < row.length; i++) {
				row[i] = total > 0 ? (row[i] / total) * 100 : 0
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
			row = new Array<number>(series.length + 1)
			row[0] = groupedTimestamp * 1e3
			for (let i = 0; i < series.length; i++) {
				row[i + 1] = series[i].data[pointIndex][1]
			}
			continue
		}

		for (let i = 0; i < series.length; i++) {
			const value = series[i].data[pointIndex][1]
			row[i + 1] = useLastValue ? value : row[i + 1] + value
		}
	}
	pushRow()

	return { dataset: { source, dimensions }, charts, seriesNames }
}

export function withoutOthersSeries(series: Array<ChartSeries>) {
	return series.some((entry) => entry.name.startsWith('Others'))
		? series.filter((entry) => !entry.name.startsWith('Others'))
		: series
}
export function selectChartBuilderSeries(
	data: { series: Array<ChartSeries> },
	{
		hideOthers,
		timePeriod,
		customTimePeriod
	}: { hideOthers: boolean; timePeriod: TimePeriod; customTimePeriod?: CustomTimePeriod | null }
) {
	let series = hideOthers ? withoutOthersSeries(data.series) : data.series
	if (timePeriod && timePeriod !== 'all')
		series = series.map((entry) => ({
			...entry,
			data: filterDataByTimePeriod(entry.data, timePeriod, customTimePeriod)
		}))
	return series === data.series ? data : { series }
}

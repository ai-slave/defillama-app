import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	type ChartConfig,
	type DashboardGrouping,
	getProDashboardChartTypeConfig,
	isDailyAverageChartType
} from '../types'
import { getGroupedMetricTitle } from '../utils'

/** How a single-metric card draws its metric at the saved grouping and cumulative setting. */
export function getSingleMetricPresentation(chart: Pick<ChartConfig, 'type' | 'grouping' | 'showCumulative'>) {
	const details = getProDashboardChartTypeConfig(chart.type)
	if (!details) throw new Error(`Unsupported dashboard chart type: ${chart.type}`)
	const isGroupable = 'groupable' in details && details.groupable === true
	const isBarChart = details.chartType === 'bar'
	const isDailyAverage = isDailyAverageChartType(chart.type)
	// A saved cumulative setting stays in the config but never applies to a daily-average metric.
	const showCumulative = (chart.showCumulative ?? false) && !isDailyAverage
	// Metrics that cannot be grouped stay daily.
	const grouping: DashboardGrouping = isGroupable ? (chart.grouping ?? 'day') : 'day'
	return {
		details,
		isGroupable,
		grouping,
		metricTitle: getGroupedMetricTitle(chart.type, details.title, grouping),
		offersCumulative: isBarChart && !isDailyAverage,
		cumulative: showCumulative && isBarChart,
		seriesType: isBarChart && !showCumulative ? ('bar' as const) : ('line' as const)
	}
}

/** Build a final millisecond dataset in one pass; cumulative is only valid for flow/bar metrics. */
export function buildSingleMetricChartDataset(
	data: ReadonlyArray<[number, number]> | undefined,
	seriesName: string,
	cumulative: boolean
): MultiSeriesChartDataset {
	if (!data?.length) return { source: [], dimensions: ['timestamp', seriesName] }

	const source = new Array<Array<number>>(data.length)
	let runningTotal = 0
	for (let i = 0; i < data.length; i++) {
		const [timestampSec, value] = data[i]
		if (cumulative) runningTotal += value
		source[i] = [timestampSec * 1e3, cumulative ? runningTotal : value]
	}

	return { source, dimensions: ['timestamp', seriesName] }
}

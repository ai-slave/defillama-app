import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'

export function getGroupedBarCharts(
	charts: MultiSeriesChartSeriesConfig[],
	groupBy: ChartTimeGroupingWithCumulative
): MultiSeriesChartSeriesConfig[] {
	if (groupBy !== 'cumulative') return charts

	return charts.map((chart) => {
		const lineChart: MultiSeriesChartSeriesConfig = { ...chart, type: 'line' }
		delete lineChart.large
		delete lineChart.barMinWidth
		delete lineChart.barMaxWidth
		return lineChart
	})
}

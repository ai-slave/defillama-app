import type { ChartTimeGroupingWithCumulative, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'

export function getGroupedBarCharts(
	charts: MultiSeriesChart2SeriesConfig[],
	groupBy: ChartTimeGroupingWithCumulative
): MultiSeriesChart2SeriesConfig[] {
	if (groupBy !== 'cumulative') return charts

	return charts.map((chart) => {
		const lineChart: MultiSeriesChart2SeriesConfig = { ...chart, type: 'line' }
		delete lineChart.large
		delete lineChart.barMinWidth
		delete lineChart.barMaxWidth
		return lineChart
	})
}

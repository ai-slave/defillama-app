import { fetchAllChartOptions, type ChartOptionsMap } from '~/containers/Downloads/chart-datasets'

let chartOptionsPromise: Promise<ChartOptionsMap> | null = null

export function loadChartOptions(): Promise<ChartOptionsMap> {
	if (!chartOptionsPromise) {
		chartOptionsPromise = fetchAllChartOptions().catch(() => ({}) as ChartOptionsMap)
	}
	return chartOptionsPromise
}

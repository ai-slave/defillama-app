import type { ChartCsvDataset } from '~/components/ChartExport/ChartCsvExportButton'
import type { LowercaseDwmcGrouping } from '~/components/ECharts/shared/ChartGroupingSelector'
import { groupStablecoinBarChartPayload } from './chartSeries'
import {
	fetchStablecoinChartSeriesData,
	fetchStablecoinVolumeChartData,
	type StablecoinChartSeriesQuery,
	type StablecoinVolumeChartQuery
} from './queries.client'
import { groupStablecoinVolumeChartPayload } from './volumeChart'

export async function fetchCompleteStablecoinVolumeCsvDataset(
	query: StablecoinVolumeChartQuery,
	groupBy: LowercaseDwmcGrouping
): Promise<ChartCsvDataset> {
	const payload = await fetchStablecoinVolumeChartData({ ...query, allSeries: true })
	if (!payload) throw new Error('Stablecoin volume data is unavailable')
	return { ...groupStablecoinVolumeChartPayload(payload, groupBy).dataset, groupBy }
}

export async function fetchCompleteStablecoinSeriesCsvDataset(
	query: StablecoinChartSeriesQuery,
	groupBy: LowercaseDwmcGrouping | null
): Promise<ChartCsvDataset> {
	const payload = await fetchStablecoinChartSeriesData(query)
	if (!payload) throw new Error('Stablecoin chart data is unavailable')
	return groupBy ? { ...groupStablecoinBarChartPayload(payload, groupBy).dataset, groupBy } : payload.dataset
}

import { fetchJson } from '~/utils/async'
import { mapMasterDirectoryOverview, mapMasterResearchReport } from './master.mappers'
import type { MasterChartColumnarResponse, MasterChartPart, MasterColumnarSeriesResponse } from './master.types'
import type { ExchangeOverviewChartModel, ExchangeResearchReportModel } from './models'

export async function fetchExchangeDirectoryOverview(): Promise<ExchangeOverviewChartModel> {
	const response = await fetchJson<MasterColumnarSeriesResponse>('/api/public/exchanges/series')
	return mapMasterDirectoryOverview(response)
}

/** Per-venue full-history columnar series (volume/OI/depth/normalized), keyed like the overview. */
export function fetchExchangeVenueSeries(exchange: string): Promise<ExchangeOverviewChartModel> {
	return fetchJson<ExchangeOverviewChartModel>(`/api/public/exchanges/${encodeURIComponent(exchange)}/history`)
}

export async function fetchExchangeResearchReport(part: MasterChartPart): Promise<ExchangeResearchReportModel> {
	const response = await fetchJson<MasterChartColumnarResponse>(`/api/public/exchanges/charts/${part}`)
	return mapMasterResearchReport(part, response)
}

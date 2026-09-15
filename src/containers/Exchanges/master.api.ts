import { fetchJson } from '~/utils/async'
import { mapMasterDirectoryOverview, mapMasterProfileMetadata, mapMasterResearchReport } from './master.mappers'
import type {
	MasterChartColumnarResponse,
	MasterChartPart,
	MasterAggregateSeriesResponse,
	MasterExchangeRegionCatalogResponse,
	MasterExchangeRegionalMetadataResponse,
	MasterExecutionSlippageResponse
} from './master.types'
import type { ExchangeOverviewChartModel, ExchangeRegionalMetadataModel, ExchangeResearchReportModel } from './models'
import { DEFAULT_RESEARCH_RANGE, type ExchangeResearchRange } from './queryState'

export async function fetchExchangeDirectoryOverview(
	range: ExchangeResearchRange = DEFAULT_RESEARCH_RANGE
): Promise<ExchangeOverviewChartModel> {
	const response = await fetchJson<MasterAggregateSeriesResponse>(
		`/api/public/exchanges/series?range=${encodeURIComponent(range)}`
	)
	return mapMasterDirectoryOverview(response)
}

/** Per-venue full-history columnar series (volume/OI/depth/normalized), keyed like the overview. */
export function fetchExchangeVenueSeries(
	exchange: string,
	range: ExchangeResearchRange
): Promise<ExchangeOverviewChartModel> {
	return fetchJson<ExchangeOverviewChartModel>(
		`/api/public/exchanges/${encodeURIComponent(exchange)}/history?range=${range}`
	)
}

/** Measured $10k slippage per venue per asset: promised against delivered. */
export function fetchExchangeExecutionSlippage(): Promise<MasterExecutionSlippageResponse> {
	return fetchJson<MasterExecutionSlippageResponse>('/api/public/exchanges/execution-slippage')
}

export function fetchExchangeRegionCatalog(): Promise<MasterExchangeRegionCatalogResponse> {
	return fetchJson<MasterExchangeRegionCatalogResponse>('/api/public/exchanges/regions')
}

export async function fetchExchangeRegionalMetadata(
	exchange: string,
	country: string
): Promise<ExchangeRegionalMetadataModel> {
	const response = await fetchJson<MasterExchangeRegionalMetadataResponse>(
		`/api/public/exchanges/${encodeURIComponent(exchange)}/metadata?country=${encodeURIComponent(country)}`
	)
	const availability = {
		country: response.country,
		region: response.region,
		availability: response.availability,
		segments: response.segments,
		note: response.note,
		source: response.source,
		usedFallback: response.used_fallback,
		// Variant funding is a directory-table concern (it drives the country-filtered
		// on/off-ramp columns). This route already returns the region's full resolved
		// metadata below, so the profile page reads rails from there instead.
		funding: null
	}
	if (response.availability === 'unavailable') {
		return { ...availability, availability: 'unavailable', segments: [] }
	}
	return {
		...availability,
		availability: response.availability,
		metadata: mapMasterProfileMetadata(response.metadata)
	}
}

export async function fetchExchangeResearchReport(
	part: MasterChartPart,
	range: ExchangeResearchRange
): Promise<ExchangeResearchReportModel> {
	const response = await fetchJson<MasterChartColumnarResponse>(`/api/public/exchanges/charts/${part}?range=${range}`)
	return mapMasterResearchReport(part, response)
}

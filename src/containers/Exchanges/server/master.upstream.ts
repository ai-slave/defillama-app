import { MARKETS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	MasterColumnarSeriesResponse,
	MasterChartColumnarResponse,
	MasterChartPart,
	MasterDirectoryResponse,
	MasterExecutionQualityResponse,
	MasterQualityRanksResponse,
	MasterRankMethodologyResponse,
	MasterExchangeIndexResponse,
	MasterExchangeMetadataResponse,
	MasterExchangeRegionCatalogResponse,
	MasterExchangeRegionManifestResponse,
	MasterMicaResponse
} from '../master.types'
import type { ExchangeResearchRange } from '../queryState'

const exchangePath = (exchange: string) => encodeURIComponent(exchange)

export function fetchMasterDirectoryFromNetwork(): Promise<MasterDirectoryResponse> {
	return fetchJson<MasterDirectoryResponse>(`${MARKETS_SERVER_URL}/exchanges/directory.json`)
}

export function fetchMasterExecutionQualityFromNetwork(): Promise<MasterExecutionQualityResponse> {
	return fetchJson<MasterExecutionQualityResponse>(`${MARKETS_SERVER_URL}/exchanges/execution-quality.json`)
}

export function fetchMasterQualityRanksFromNetwork(): Promise<MasterQualityRanksResponse> {
	return fetchJson<MasterQualityRanksResponse>(`${MARKETS_SERVER_URL}/exchanges/quality-ranks.json`)
}

export function fetchMasterRankMethodologyFromNetwork(): Promise<MasterRankMethodologyResponse> {
	return fetchJson<MasterRankMethodologyResponse>(`${MARKETS_SERVER_URL}/exchanges/rank-methodology.json`)
}

export function fetchMasterExchangeSeriesFromNetwork(
	range: ExchangeResearchRange
): Promise<MasterColumnarSeriesResponse> {
	return fetchJson<MasterColumnarSeriesResponse>(`${MARKETS_SERVER_URL}/exchanges/series/${range}.json`)
}

export function fetchMasterExchangeHistoryFromNetwork(
	exchange: string,
	range: ExchangeResearchRange
): Promise<MasterColumnarSeriesResponse> {
	return fetchJson<MasterColumnarSeriesResponse>(
		`${MARKETS_SERVER_URL}/exchanges/${exchangePath(exchange)}/series/${range}.json`
	)
}

export function fetchMasterExchangeIndexFromNetwork(exchange: string): Promise<MasterExchangeIndexResponse> {
	return fetchJson<MasterExchangeIndexResponse>(`${MARKETS_SERVER_URL}/exchanges/${exchangePath(exchange)}/index.json`)
}

export function fetchMasterExchangeMetadataFromNetwork(exchange: string): Promise<MasterExchangeMetadataResponse> {
	return fetchJson<MasterExchangeMetadataResponse>(
		`${MARKETS_SERVER_URL}/exchanges/${exchangePath(exchange)}/metadata.json`
	)
}

export function fetchMasterExchangeRegionCatalogFromNetwork(): Promise<MasterExchangeRegionCatalogResponse> {
	return fetchJson<MasterExchangeRegionCatalogResponse>(`${MARKETS_SERVER_URL}/exchanges/regions.json`)
}

export function fetchMasterExchangeRegionManifestFromNetwork(
	exchange: string
): Promise<MasterExchangeRegionManifestResponse> {
	return fetchJson<MasterExchangeRegionManifestResponse>(
		`${MARKETS_SERVER_URL}/exchanges/${exchangePath(exchange)}/metadata/regions.json`
	)
}

export function fetchMasterExchangeRegionalMetadataFromNetwork(
	exchange: string,
	region: string
): Promise<MasterExchangeMetadataResponse> {
	return fetchJson<MasterExchangeMetadataResponse>(
		`${MARKETS_SERVER_URL}/exchanges/${exchangePath(exchange)}/metadata/${encodeURIComponent(region)}.json`
	)
}

export function fetchMasterMicaFromNetwork(): Promise<MasterMicaResponse> {
	return fetchJson<MasterMicaResponse>(`${MARKETS_SERVER_URL}/exchanges/mica.json`)
}

export function fetchMasterChartFromNetwork(
	part: MasterChartPart,
	range: ExchangeResearchRange
): Promise<MasterChartColumnarResponse> {
	return fetchJson<MasterChartColumnarResponse>(`${MARKETS_SERVER_URL}/charts/${part}/${range}.json`)
}

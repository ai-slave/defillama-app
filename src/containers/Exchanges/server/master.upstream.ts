import { MARKETS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	MasterColumnarSeriesResponse,
	MasterChartColumnarResponse,
	MasterChartPart,
	MasterDirectoryResponse,
	MasterExchangeIndexResponse,
	MasterExchangeMetadataResponse,
	MasterMicaResponse
} from '../master.types'

const exchangePath = (exchange: string) => encodeURIComponent(exchange)

export function fetchMasterDirectoryFromNetwork(): Promise<MasterDirectoryResponse> {
	return fetchJson<MasterDirectoryResponse>(`${MARKETS_SERVER_URL}/exchanges/directory.json`)
}

export function fetchMasterExchangeSeriesFromNetwork(): Promise<MasterColumnarSeriesResponse> {
	return fetchJson<MasterColumnarSeriesResponse>(`${MARKETS_SERVER_URL}/exchanges/series.json`)
}

export function fetchMasterExchangeHistoryFromNetwork(exchange: string): Promise<MasterColumnarSeriesResponse> {
	return fetchJson<MasterColumnarSeriesResponse>(
		`${MARKETS_SERVER_URL}/exchanges/${exchangePath(exchange)}/series.json`
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

export function fetchMasterMicaFromNetwork(): Promise<MasterMicaResponse> {
	return fetchJson<MasterMicaResponse>(`${MARKETS_SERVER_URL}/exchanges/mica.json`)
}

export function fetchMasterChartFromNetwork(part: MasterChartPart): Promise<MasterChartColumnarResponse> {
	return fetchJson<MasterChartColumnarResponse>(`${MARKETS_SERVER_URL}/charts/${part}.json`)
}

import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	ChainAssetsDetailResponse,
	ChainAssetsChartResponse,
	ChainsAssetTotalsResponse,
	ChainsAssetsFlows1dResponse,
	RawChainAssetsChartResponse,
	RawChainAssetsFlows1dResponse,
	RawChainsAssetsResponse
} from './api.types'
import {
	normalizeChainAssetsChartResponse,
	normalizeChainAssetsDetailResponse,
	normalizeChainAssetsFlows1dResponse,
	normalizeChainsAssetTotalsResponse
} from './normalizers'

/** Normalize full token breakdowns only for the selected chain; navigation needs totals for the rest. */
export async function fetchChainAssetsDetail(chain: string): Promise<ChainAssetsDetailResponse> {
	const response = await fetchJson<RawChainsAssetsResponse>(`${SERVER_URL}/chain-assets/chains`)
	return normalizeChainAssetsDetailResponse(response, chain)
}

export async function fetchChainsAssetTotals(): Promise<ChainsAssetTotalsResponse> {
	const response = await fetchJson<RawChainsAssetsResponse>(`${SERVER_URL}/chain-assets/chains`)
	return normalizeChainsAssetTotalsResponse(response)
}

/**
 * Fetch 24-hour bridged asset flow totals by chain.
 */
export async function fetchChainAssetsFlows1d(): Promise<ChainsAssetsFlows1dResponse> {
	const response = await fetchJson<RawChainAssetsFlows1dResponse>(`${SERVER_URL}/chain-assets/flows/24h`)
	return normalizeChainAssetsFlows1dResponse(response)
}

/**
 * Fetch historical bridged asset chart data for one chain. The shared response keeps Unix seconds;
 * renderers that require milliseconds convert at their display boundary.
 */
export async function fetchChainAssetsChart(chain: string): Promise<ChainAssetsChartResponse> {
	const response = await fetchRawChainAssetsChart(chain)
	return normalizeChainAssetsChartResponse(response)
}

export async function fetchRawChainAssetsChart(chain: string): Promise<RawChainAssetsChartResponse> {
	return fetchJson<RawChainAssetsChartResponse>(`${SERVER_URL}/chain-assets/chart/${encodeURIComponent(chain)}`)
}

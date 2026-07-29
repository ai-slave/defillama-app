import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	ChainAssetsChartResponse,
	ChainsAssetTotalsResponse,
	ChainsAssetsFlows1dResponse,
	ChainsAssetsResponse,
	RawChainAssetsChartResponse,
	RawChainAssetsFlows1dResponse,
	RawChainsAssetsResponse
} from './api.types'
import {
	normalizeChainAssetsChartResponse,
	normalizeChainAssetsFlows1dResponse,
	normalizeChainsAssetTotalsResponse,
	normalizeChainsAssetsResponse
} from './normalizers'

/**
 * Fetch chain-level bridged asset totals.
 */
export async function fetchChainsAssets(): Promise<ChainsAssetsResponse> {
	const response = await fetchJson<RawChainsAssetsResponse>(`${SERVER_URL}/chain-assets/chains`)
	return normalizeChainsAssetsResponse(response)
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

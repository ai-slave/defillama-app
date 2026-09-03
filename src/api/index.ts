import { COINS_SERVER_URL, CONFIG_API, DATASETS_SERVER_URL, SEARCH_API_TOKEN, SEARCH_API_URL } from '~/constants'
import { fetchJson, getFastJsonTimeoutMs } from '~/utils/async'
import type { CoinsChartResponse, LlamaConfigResponse, SearchQuery, BlockExplorersResponse } from './types'

// ---------------------------------------------------------------------------
// DefiLlama multi-search API
// ---------------------------------------------------------------------------

/** Generic search API helper for the DefiLlama multi-search endpoint. */
export async function searchApi<T = Record<string, unknown>>(query: SearchQuery): Promise<Array<T>> {
	return multiSearchApi<T>([query]).then((results) => results[0] ?? [])
}

/** Run several queries in one multi-search request; returns hits per query, in order. */
export async function multiSearchApi<T = Record<string, unknown>>(queries: SearchQuery[]): Promise<Array<Array<T>>> {
	return fetchJson(SEARCH_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${SEARCH_API_TOKEN}`
		},
		body: JSON.stringify({ queries })
	}).then((res) => queries.map((_, i) => res?.results?.[i]?.hits ?? []))
}

// ---------------------------------------------------------------------------
// Shared APIs
// ---------------------------------------------------------------------------

const COINS_CHART_API_URL = `${COINS_SERVER_URL}/chart`
// DefiLlama Coins API queries
// ---------------------------------------------------------------------------

/** Fetch the global DefiLlama protocol/chain config (chainCoingeckoIds, etc.). */
export async function fetchLlamaConfig(): Promise<LlamaConfigResponse> {
	return fetchJson<LlamaConfigResponse>(CONFIG_API)
}

/** Fetch historical price chart for a single coin from the coins.llama.fi chart API. */
export async function fetchCoinsChart(params: {
	coin: string
	start: number
	span: number
	searchWidth?: string
}): Promise<CoinsChartResponse> {
	const { coin, start, span, searchWidth } = params
	if (!coin || !Number.isFinite(start) || !Number.isFinite(span) || span <= 0) return { coins: {} }

	const searchParams = new URLSearchParams({
		start: String(start),
		span: String(span)
	})
	if (searchWidth) searchParams.set('searchWidth', searchWidth)

	return fetchJson<CoinsChartResponse>(`${COINS_CHART_API_URL}/${encodeURIComponent(coin)}?${searchParams.toString()}`)
}

// ---------------------------------------------------------------------------
// Block Explorers
// ---------------------------------------------------------------------------

const BLOCK_EXPLORERS_API_URL = `${DATASETS_SERVER_URL}/blockExplorers.json`

/** Fetch block explorer URLs for all chains from the datasets server. */
export async function fetchBlockExplorers(): Promise<BlockExplorersResponse> {
	return fetchJson<BlockExplorersResponse>(BLOCK_EXPLORERS_API_URL, { timeout: getFastJsonTimeoutMs() })
}

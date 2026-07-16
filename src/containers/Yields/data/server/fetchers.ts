import { YIELDS_V2_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { BorrowMarketRow, DepegRow, EarnRow, LoopRow, RouteRow, TokenKeys, Trend, YieldsMeta } from '../types'

type FetchOptions = { extraRetry?: boolean; timeout?: number }

// Every yields v2 endpoint wraps its payload in a `{ data }` envelope.
async function fetchYieldsData<T>(path: string, options?: FetchOptions): Promise<T> {
	const { extraRetry = false, ...requestOptions } = options ?? {}
	const response = await fetchJson<{ data: T }>(`${YIELDS_V2_SERVER_URL}${path}`, requestOptions, extraRetry)
	return response.data
}

export function fetchEarnFromNetwork(options?: FetchOptions): Promise<EarnRow[]> {
	return fetchYieldsData<EarnRow[]>('/v2/earn', options)
}

export function fetchTrendsFromNetwork(options?: FetchOptions): Promise<Trend[]> {
	return fetchYieldsData<Trend[]>('/v2/earn/trends', options)
}

export function fetchBorrowMarketsFromNetwork(options?: FetchOptions): Promise<BorrowMarketRow[]> {
	return fetchYieldsData<BorrowMarketRow[]>('/v2/borrow/markets', options)
}

export function fetchBorrowRoutesFromNetwork(options?: FetchOptions): Promise<RouteRow[]> {
	return fetchYieldsData<RouteRow[]>('/v2/borrow/routes', options)
}

export function fetchLoopsFromNetwork(options?: FetchOptions): Promise<LoopRow[]> {
	return fetchYieldsData<LoopRow[]>('/v2/loops', options)
}

export function fetchTokenKeysFromNetwork(options?: FetchOptions): Promise<TokenKeys[]> {
	return fetchYieldsData<TokenKeys[]>('/v2/tokens', options)
}

export function fetchYieldsMetaFromNetwork(options?: FetchOptions): Promise<YieldsMeta> {
	return fetchYieldsData<YieldsMeta>('/v2/meta', options)
}

export function fetchDepegsFromNetwork(options?: FetchOptions): Promise<DepegRow[]> {
	return fetchYieldsData<DepegRow[]>('/v2/depegs', options)
}

export function fetchExploitsFromNetwork(options?: FetchOptions): Promise<string[]> {
	return fetchYieldsData<string[]>('/v2/exploits', options)
}

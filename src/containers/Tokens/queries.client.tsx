import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { toQueryString } from '~/utils/routerQuery'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensChartResponse, type TokensPageResponse } from './types'
import { MAX_TOKENS_TABLE_PAGE_SIZE } from './utils'

export const TOKENS_API = '/api/public/tokens'
export const TOKENS_MARKET_MAP_API = '/api/public/tokens/market-map'

async function fetchTokensResponse<T extends TokensPageResponse | TokensChartResponse>(
	url: string,
	signal: AbortSignal
) {
	const data = await fetchJson<T>(
		`${url}${url.includes('?') ? '&' : '?'}schemaVersion=${TOKENS_PAGE_RESPONSE_SCHEMA_VERSION}`,
		{ signal }
	)
	// A new client can still reach an old origin during deployment, even with a versioned URL.
	if (data.schemaVersion !== TOKENS_PAGE_RESPONSE_SCHEMA_VERSION) {
		throw new Error('Token data is updating. Please retry.')
	}
	return data
}

export function useTokensPaginatedTable(queryString: string | null, initialData: TokensPageResponse) {
	const hasCurrentInitialData = initialData.schemaVersion === TOKENS_PAGE_RESPONSE_SCHEMA_VERSION
	const shouldUseInitialData = hasCurrentInitialData && queryString === ''
	const url = queryString == null ? null : `${TOKENS_API}${queryString}`

	return useQuery<TokensPageResponse>({
		queryKey: ['tokens-page', TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, queryString],
		queryFn: async ({ signal }) => (url ? fetchTokensResponse<TokensPageResponse>(url, signal) : initialData),
		...(shouldUseInitialData ? { initialData } : {}),
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!url && !shouldUseInitialData
	})
}

export function useWatchlistTokensTable(ids: Array<string>) {
	const queryString =
		ids.length > 0 ? toQueryString({ ids: ids.join(','), pageSize: String(MAX_TOKENS_TABLE_PAGE_SIZE) }) : null

	return useQuery<TokensPageResponse>({
		queryKey: ['tokens-watchlist', TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, queryString],
		queryFn: async ({ signal }) => fetchTokensResponse<TokensPageResponse>(`${TOKENS_API}${queryString}`, signal),
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!queryString
	})
}

/** Top-300-by-mcap dataset behind the market map and movers views; `queryString` carries only filters. */
export function useTokensChartDataset(queryString: string | null) {
	return useQuery<TokensChartResponse>({
		queryKey: ['tokens-market-map', TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, queryString],
		queryFn: async ({ signal }) =>
			fetchTokensResponse<TokensChartResponse>(`${TOKENS_MARKET_MAP_API}${queryString}`, signal),
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: queryString != null
	})
}

import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { toQueryString } from '~/utils/routerQuery'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensPageResponse } from './types'
import { MAX_TOKENS_TABLE_PAGE_SIZE } from './utils'

export const TOKENS_API = '/api/public/tokens'

export function useTokensPaginatedTable(queryString: string | null, initialData: TokensPageResponse) {
	const hasCurrentInitialData = initialData.schemaVersion === TOKENS_PAGE_RESPONSE_SCHEMA_VERSION
	const shouldUseInitialData = hasCurrentInitialData && queryString === ''
	const url = queryString == null ? null : `${TOKENS_API}${queryString}`

	return useQuery<TokensPageResponse>({
		queryKey: ['tokens-page', TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, queryString],
		queryFn: async ({ signal }) => (url ? fetchJson<TokensPageResponse>(url, { signal }) : initialData),
		initialData: shouldUseInitialData ? initialData : undefined,
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!url && !shouldUseInitialData
	})
}

export function useWatchlistTokensTable(ids: string[]) {
	const queryString = ids.length
		? toQueryString({ ids: ids.join(','), pageSize: String(MAX_TOKENS_TABLE_PAGE_SIZE) })
		: null

	return useQuery<TokensPageResponse>({
		queryKey: ['tokens-watchlist', TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, queryString],
		queryFn: async ({ signal }) => fetchJson<TokensPageResponse>(`${TOKENS_API}${queryString}`, { signal }),
		placeholderData: (previousData) => previousData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !!queryString
	})
}

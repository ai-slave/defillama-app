import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensPageResponse } from './types'

const TOKENS_API = '/api/public/tokens'

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

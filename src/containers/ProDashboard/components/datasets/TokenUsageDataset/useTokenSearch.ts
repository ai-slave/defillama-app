import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '~/utils/async'

export interface TokenOption {
	value: string
	label: string
	logo?: string
	id: string
	price?: number | null
}

export function useTokenSearch(searchQuery: string, enabled: boolean) {
	return useQuery<TokenOption[]>({
		queryKey: ['pro-dashboard', 'token-search', searchQuery],
		queryFn: async () =>
			fetchJson(`/api/dynamic/pro-dashboard/tokens/search?query=${encodeURIComponent(searchQuery || '')}`),
		enabled,
		staleTime: 5 * 60 * 1000,
		placeholderData: []
	})
}

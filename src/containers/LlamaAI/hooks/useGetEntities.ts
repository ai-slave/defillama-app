import { useQuery } from '@tanstack/react-query'
import { searchApi } from '~/api'
import { searchTokens } from '~/containers/TokenSearch/search'
import { useDebouncedValue } from '~/hooks/useDebounce'

export interface EntityResult {
	id: string
	name: string
	logo: string | null
	type: string
	deprecated?: boolean
	subName?: string
}

/**
 * Fetch entities (chains, protocols, stablecoins, categories) matching the query.
 */
async function fetchEntities(query: string): Promise<Array<EntityResult>> {
	// `pages` index only exposes `type` as a filterable attribute, so deprecated/subName
	// have to be filtered out client-side after the fetch. We over-fetch to leave headroom
	// once the unwanted hits are removed.
	const hits = await searchApi<EntityResult>({
		indexUid: 'pages',
		limit: 25,
		offset: 0,
		q: query,
		filter: [['type = Chain', 'type = Protocol', 'type = Stablecoin', 'type = Category']]
	})

	return hits.filter((hit) => !hit.deprecated && !hit.subName).slice(0, 10)
}

/**
 * Fetch coins/tokens matching the query.
 */
export async function fetchCoins(query: string, limit: number = 10): Promise<Array<EntityResult>> {
	const tokens = await searchTokens(query, limit)

	return tokens.map((token) => ({
		id: token.searchId,
		name: token.name,
		logo: token.logo,
		type: 'Coin'
	}))
}

/**
 * Hook for fetching entities or coins based on trigger character.
 * - @ prefix: fetches entities (chains, protocols, etc.)
 * - $ prefix: fetches coins/tokens
 */
export function useGetEntities(q: string) {
	const debouncedQuery = useDebouncedValue(q, 200)

	const isCoins = debouncedQuery.startsWith('$')
	const isEntities = debouncedQuery.startsWith('@')
	const queryWithoutTrigger = isCoins || isEntities ? debouncedQuery.slice(1) : debouncedQuery
	const isBareTrigger = debouncedQuery === '$' || debouncedQuery === '@'

	return useQuery({
		queryKey: ['llamaai', 'entities', debouncedQuery],
		queryFn: () => (isCoins ? fetchCoins(queryWithoutTrigger) : fetchEntities(queryWithoutTrigger)),
		// Fetch defaults when user typed a bare trigger (@ / $), otherwise only fetch when there's a query
		enabled: queryWithoutTrigger.length > 0 || isBareTrigger,
		staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
		refetchOnWindowFocus: false
	})
}

import { useQuery } from '@tanstack/react-query'
import { YIELD_BORROW_ROUTES_DATASET_API } from '~/containers/Yields/constants'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { fetchJson } from '~/utils/async'
import type { TokenBorrowRoutesData } from './types'

type BorrowRoutesResponse = { rows: RouteTableRow[] }

// Build the /yields/borrow-routes URL for one leg, scoped to the resolved token
// option keys, sorted by net APY desc, unpaginated (matches the SSR snapshot).
function buildBorrowRoutesUrl(legKey: 'collateralToken' | 'borrowToken', tokenKeys: string[]): string {
	const params = new URLSearchParams()
	for (const key of tokenKeys) params.append(legKey, key)
	params.set('sortBy', 'net_apy')
	params.set('sortDesc', 'true')
	params.set('pageSize', 'all')
	return `${YIELD_BORROW_ROUTES_DATASET_API}?${params.toString()}`
}

async function fetchTokenBorrowRoutes(tokenKeys: string[]): Promise<TokenBorrowRoutesData> {
	const [useAsCollateral, borrowThis] = await Promise.all([
		fetchJson<BorrowRoutesResponse>(buildBorrowRoutesUrl('collateralToken', tokenKeys)),
		fetchJson<BorrowRoutesResponse>(buildBorrowRoutesUrl('borrowToken', tokenKeys))
	])
	return { useAsCollateral: useAsCollateral.rows, borrowThis: borrowThis.rows }
}

export function useTokenBorrowRoutes(tokenKeys: string[], { enabled = true }: { enabled?: boolean } = {}) {
	return useQuery({
		queryKey: ['token-borrow-routes', 'token-page', ...tokenKeys],
		queryFn: () => fetchTokenBorrowRoutes(tokenKeys),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: tokenKeys.length > 0 && enabled
	})
}

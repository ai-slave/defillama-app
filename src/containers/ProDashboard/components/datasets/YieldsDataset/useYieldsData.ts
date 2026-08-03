import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '~/containers/ProDashboard/queryPolicy'
import { getProYieldsDatasetQueryKey } from '~/containers/ProDashboard/tableQueryKeys'
import type { EarnPageRow, MarketTableRow } from '~/containers/Yields/data/types'
import type { YieldsPaginatedTableResponse } from '~/containers/Yields/yieldsTableQuery'
import { fetchJson } from '~/utils/async'
import { joinEarnAndBorrowMarkets, type ProYieldRow } from '../../../yieldData'

export async function fetchProYieldsData(chains: string[] = []): Promise<ProYieldRow[]> {
	const params = new URLSearchParams({ pageSize: 'all', includeMemeTokens: 'true' })
	for (const chain of chains) if (chain !== 'All') params.append('chain', chain)

	const query = params.toString()
	const [earn, markets] = await Promise.all([
		fetchJson<YieldsPaginatedTableResponse<EarnPageRow>>(`/api/public/yields/earn?${query}`),
		fetchJson<YieldsPaginatedTableResponse<MarketTableRow>>(`/api/public/yields/borrow-markets?${query}`)
	])
	return joinEarnAndBorrowMarkets(earn.rows, markets.rows)
}

export function useYieldsData(chains?: string[]) {
	const streamDone = useContext(StreamDoneContext)
	const selectedChains = chains ?? []

	const query = useQuery({
		queryKey: getProYieldsDatasetQueryKey(selectedChains),
		queryFn: () => fetchProYieldsData(selectedChains),
		enabled: streamDone,
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		retry: 1
	})
	return { ...query, isLoading: query.isLoading || (!streamDone && query.data === undefined) }
}

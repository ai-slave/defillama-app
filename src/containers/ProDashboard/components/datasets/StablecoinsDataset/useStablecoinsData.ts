import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchStablecoinsTableData, type StablecoinsTableData } from '~/containers/ProDashboard/stablecoinData'
import { getProStablecoinsTableQueryKey } from '~/containers/ProDashboard/tableQueryKeys'

export type StablecoinsTableRow = StablecoinsTableData[number]

export function useStablecoinsData(chain: string) {
	const streamDone = useContext(StreamDoneContext)
	const query = useQuery({
		queryKey: getProStablecoinsTableQueryKey(chain),
		queryFn: () => fetchStablecoinsTableData(chain),
		enabled: streamDone,
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchInterval: 5 * 60 * 1000 // 5 minutes
	})
	return { query, isLoading: query.isLoading || (!streamDone && query.data === undefined) }
}

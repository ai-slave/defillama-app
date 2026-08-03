import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '~/containers/ProDashboard/queryPolicy'
import { getProChainsDatasetQueryKey } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchJson } from '~/utils/async'

export function useChainsData(category?: string) {
	const streamDone = useContext(StreamDoneContext)
	const queryParams = category ? `?category=${encodeURIComponent(category)}` : ''

	const query = useQuery<ChainsDatasetRow[]>({
		queryKey: getProChainsDatasetQueryKey(category),
		queryFn: () => fetchJson<ChainsDatasetRow[]>(`/api/dynamic/chains${queryParams}`),
		enabled: streamDone,
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		retry: 1
	})
	return { ...query, isLoading: query.isLoading || (!streamDone && query.data === undefined) }
}

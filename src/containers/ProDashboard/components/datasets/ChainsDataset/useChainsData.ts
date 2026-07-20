import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import { getProChainsDatasetQueryKey } from '~/containers/ProDashboard/tableQueryKeys'
import { fetchJson } from '~/utils/async'

export function useChainsData(category?: string) {
	const streamDone = useContext(StreamDoneContext)
	const queryParams = category ? `?category=${encodeURIComponent(category)}` : ''

	return useQuery({
		queryKey: getProChainsDatasetQueryKey(category),
		queryFn: () => fetchJson(`/api/dynamic/chains${queryParams}`),
		enabled: streamDone,
		staleTime: Infinity,
		retry: 1
	})
}

import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import {
	getProDimensionDatasetQueryKey,
	getProDimensionDatasetRoute,
	type ProDimensionDatasetType
} from '~/containers/ProDashboard/tableQueryKeys'
import { fetchJson } from '~/utils/async'

const EMPTY_CHAINS: string[] = []

export function useDimensionDatasetData<T = DimensionDatasetProtocol>(
	datasetType: ProDimensionDatasetType,
	chains?: string[]
) {
	const streamDone = useContext(StreamDoneContext)
	const selectedChains = chains ?? EMPTY_CHAINS
	const requestChains = selectedChains.includes('All') ? EMPTY_CHAINS : selectedChains
	const query = requestChains.length
		? `?${requestChains.map((chain) => `chains=${encodeURIComponent(chain)}`).join('&')}`
		: ''

	return useQuery<T[]>({
		queryKey: getProDimensionDatasetQueryKey(datasetType, selectedChains),
		queryFn: () => fetchJson<T[]>(`/api/dynamic/adapter-metrics/${getProDimensionDatasetRoute(datasetType)}${query}`),
		enabled: streamDone,
		staleTime: Infinity,
		retry: 1
	})
}

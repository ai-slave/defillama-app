import { useQuery } from '@tanstack/react-query'
import type { DimensionDatasetResult } from '~/containers/AdapterMetrics/datasetTypes'
import { fetchJson } from '~/utils/async'
import type { DimensionProtocols } from '../templates'

type DimensionProtocol = NonNullable<DimensionProtocols['perps']>[number]

export function useDimensionProtocols() {
	const perps = useQuery({
		queryKey: ['pro-dashboard', 'dimension-protocols', 'perps'],
		queryFn: () => fetchJson<DimensionDatasetResult<DimensionProtocol>>('/api/dynamic/adapter-metrics/perps'),
		staleTime: Infinity,
		retry: 1
	})

	const dexs = useQuery({
		queryKey: ['pro-dashboard', 'dimension-protocols', 'dexs'],
		queryFn: () => fetchJson<DimensionDatasetResult<DimensionProtocol>>('/api/dynamic/adapter-metrics/dexs'),
		staleTime: Infinity,
		retry: 1
	})

	const dexAggregators = useQuery({
		queryKey: ['pro-dashboard', 'dimension-protocols', 'aggregators'],
		queryFn: () => fetchJson<DimensionDatasetResult<DimensionProtocol>>('/api/dynamic/adapter-metrics/dex-aggregators'),
		staleTime: Infinity,
		retry: 1
	})

	return { perps, dexs, dexAggregators }
}

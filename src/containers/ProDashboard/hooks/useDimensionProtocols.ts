import { useQuery } from '@tanstack/react-query'
import type { DimensionDatasetResult } from '~/containers/AdapterMetrics/datasetTypes'
import { fetchJson } from '~/utils/async'
import type { DimensionProtocols } from '../templates'

const EMPTY_PROTOCOLS: NonNullable<DimensionProtocols['perps']> = []
type DimensionProtocol = (typeof EMPTY_PROTOCOLS)[number]

export function useDimensionProtocols() {
	const { data: perpsData, isLoading: perpsLoading } = useQuery({
		queryKey: ['pro-dashboard', 'dimension-protocols', 'perps'],
		queryFn: () => fetchJson<DimensionDatasetResult<DimensionProtocol>>('/api/dynamic/adapter-metrics/perps'),
		staleTime: Infinity,
		retry: 1
	})

	const { data: dexsData, isLoading: dexsLoading } = useQuery({
		queryKey: ['pro-dashboard', 'dimension-protocols', 'dexs'],
		queryFn: () => fetchJson<DimensionDatasetResult<DimensionProtocol>>('/api/dynamic/adapter-metrics/dexs'),
		staleTime: Infinity,
		retry: 1
	})

	const { data: aggregatorsData, isLoading: aggregatorsLoading } = useQuery({
		queryKey: ['pro-dashboard', 'dimension-protocols', 'aggregators'],
		queryFn: () => fetchJson<DimensionDatasetResult<DimensionProtocol>>('/api/dynamic/adapter-metrics/dex-aggregators'),
		staleTime: Infinity,
		retry: 1
	})

	const dimensionProtocols: DimensionProtocols = {
		perps: perpsData?.protocols ?? EMPTY_PROTOCOLS,
		dexs: dexsData?.protocols ?? EMPTY_PROTOCOLS,
		dexAggregators: aggregatorsData?.protocols ?? EMPTY_PROTOCOLS
	}

	const isLoading = perpsLoading || dexsLoading || aggregatorsLoading

	return { dimensionProtocols, isLoading }
}

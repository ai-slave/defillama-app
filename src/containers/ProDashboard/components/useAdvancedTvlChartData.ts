import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useIdleChartComputation } from '../hooks/useIdleChartComputation'
import {
	fetchProtocolTvlBreakdown,
	getAdvancedTvlBreakdownSources,
	getProtocolTvlBreakdownQueryKey
} from '../services/protocolTvl'
import type { AdvancedTvlChartType } from '../types'
import { buildAdvancedTvlChartData, type AdvancedTvlChartData } from './advancedTvlChartData'

const EMPTY_ADVANCED_TVL_DATA: AdvancedTvlChartData = {
	dataset: null,
	breakdown: null,
	seriesNames: [],
	defaultSeriesNames: [],
	pieSeries: { peers: [], limit: 15, upstreamOthersValue: 0 }
}

export function useAdvancedTvlChartData({
	protocol,
	protocolName,
	chartType,
	extraTvlsEnabled,
	enabled
}: {
	protocol: string
	protocolName: string
	chartType: AdvancedTvlChartType
	extraTvlsEnabled: Record<string, boolean>
	enabled: boolean
}) {
	const sources = useMemo(
		() => getAdvancedTvlBreakdownSources(protocol, chartType, extraTvlsEnabled),
		[protocol, chartType, extraTvlsEnabled]
	)
	const queries = useQueries({
		queries: sources.map((source) => ({
			queryKey: getProtocolTvlBreakdownQueryKey(source.request),
			queryFn: () => fetchProtocolTvlBreakdown(source.request),
			enabled,
			staleTime: 60 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0
		}))
	})
	const hasSourceData = sources.length > 0 && queries.every((query) => query.data !== undefined)
	const canCompute = enabled || hasSourceData
	const isNetworkLoading = enabled && queries.some((query) => query.isLoading)
	const computeSignature = [
		protocol,
		protocolName,
		chartType,
		sources.map((source) => JSON.stringify(getProtocolTvlBreakdownQueryKey(source.request))).join('|'),
		queries.map((query) => query.dataUpdatedAt).join('|')
	].join('::')
	const { value: data, isComputing } = useIdleChartComputation({
		enabled: canCompute && !isNetworkLoading,
		signature: computeSignature,
		input: { chartType, sources, breakdowns: queries.map((query) => query.data), protocolName },
		compute: (input) => buildAdvancedTvlChartData(input.chartType, input.sources, input.breakdowns, input.protocolName),
		emptyValue: EMPTY_ADVANCED_TVL_DATA
	})

	return {
		data,
		isLoading: isNetworkLoading || (canCompute && isComputing),
		readFailed: enabled && queries.some((query) => query.errorUpdatedAt > query.dataUpdatedAt),
		isFetching: enabled && queries.some((query) => query.isFetching),
		refetch: () => {
			for (const query of queries) void query.refetch()
		},
		hasSourceData,
		sources
	}
}

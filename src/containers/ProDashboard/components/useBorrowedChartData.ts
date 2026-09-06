import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useIdleChartComputation } from '../hooks/useIdleChartComputation'
import {
	fetchProtocolTvlBreakdown,
	getBorrowedBreakdownSources,
	getProtocolTvlBreakdownQueryKey
} from '../services/protocolTvl'
import type { BorrowedChartType } from '../types'
import { buildBorrowedChartData } from './borrowedChartData'

const EMPTY_BORROWED_CHART_DATA: ReturnType<typeof buildBorrowedChartData> = {
	dataset: null,
	breakdown: null,
	seriesNames: [],
	defaultSeriesNames: [],
	pieSeries: { peers: [], limit: 15, upstreamOthersValue: 0 }
}

export function useBorrowedChartData({
	protocol,
	chartType,
	enabled,
	staleTime
}: {
	protocol: string
	chartType: BorrowedChartType
	enabled: boolean
	staleTime: number
}) {
	const sources = useMemo(() => getBorrowedBreakdownSources(protocol, chartType), [protocol, chartType])
	const queries = useQueries({
		queries: sources.map((source) => ({
			queryKey: getProtocolTvlBreakdownQueryKey(source.request),
			queryFn: () => fetchProtocolTvlBreakdown(source.request),
			enabled,
			staleTime
		}))
	})
	const firstBreakdown = queries[0]?.data
	const secondBreakdown = queries[1]?.data
	const hasSourceData = sources.length > 0 && queries.every((query) => query.data !== undefined)
	const canCompute = enabled || hasSourceData
	const isNetworkLoading = enabled && queries.some((query) => query.isLoading)
	const computeSignature = [protocol, chartType, ...queries.map((query) => query.dataUpdatedAt)].join('::')
	const { value: data, isComputing } = useIdleChartComputation({
		enabled: canCompute && !isNetworkLoading,
		signature: computeSignature,
		input: { chartType, sources, breakdowns: [firstBreakdown, secondBreakdown] },
		compute: (input) => buildBorrowedChartData(input.chartType, input.sources, input.breakdowns),
		emptyValue: EMPTY_BORROWED_CHART_DATA
	})

	return { data, isLoading: isNetworkLoading || (canCompute && isComputing), hasSourceData }
}

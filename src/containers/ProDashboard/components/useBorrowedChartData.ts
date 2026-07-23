import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { useIdleChartComputation } from '../hooks/useIdleChartComputation'
import {
	fetchBorrowedBreakdownForDashboard,
	getBorrowedBreakdownQueryKey,
	getBorrowedBreakdownSources
} from '../services/protocolTvl'
import type { BorrowedChartType } from '../types'
import { buildBorrowedChartData } from './borrowedChartData'

const EMPTY_BORROWED_CHART_DATA = {
	dataset: null,
	breakdown: null,
	seriesNames: [] as string[],
	defaultSeriesNames: [] as string[],
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
			queryKey: getBorrowedBreakdownQueryKey(source.request),
			queryFn: () => fetchBorrowedBreakdownForDashboard(source.request),
			enabled,
			staleTime
		}))
	}) as Array<UseQueryResult<IProtocolChainBreakdownChart | null>>
	const firstBreakdown = queries[0]?.data
	const secondBreakdown = queries[1]?.data
	const isNetworkLoading = enabled && queries.some((query) => query.isLoading)
	const computeSignature = [protocol, chartType, ...queries.map((query) => query.dataUpdatedAt)].join('::')
	const latestInputRef = useRef({ chartType, sources, breakdowns: [firstBreakdown, secondBreakdown] })
	latestInputRef.current = { chartType, sources, breakdowns: [firstBreakdown, secondBreakdown] }
	const { value: data, isComputing } = useIdleChartComputation({
		enabled: enabled && !isNetworkLoading,
		signature: computeSignature,
		compute: () => {
			const input = latestInputRef.current
			return buildBorrowedChartData(input.chartType, input.sources, input.breakdowns)
		},
		emptyValue: EMPTY_BORROWED_CHART_DATA
	})

	return { data, isLoading: isNetworkLoading || (enabled && isComputing) }
}

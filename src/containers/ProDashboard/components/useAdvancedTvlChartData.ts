import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	fetchProtocolTvlBreakdownForDashboard,
	getAdvancedTvlBreakdownSources,
	getProtocolTvlBreakdownQueryKey,
	type ProtocolTvlBreakdownChart
} from '../services/protocolTvl'
import type { AdvancedTvlChartType } from '../types'
import { buildAdvancedTvlChartData, type AdvancedTvlChartData } from './advancedTvlChartData'

const EMPTY_ADVANCED_TVL_DATA = {
	dataset: null,
	breakdown: null,
	seriesNames: [] as string[],
	defaultSeriesNames: [] as string[],
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
	const queries: Array<UseQueryResult<ProtocolTvlBreakdownChart>> = useQueries({
		queries: sources.map((source) => ({
			queryKey: getProtocolTvlBreakdownQueryKey(source.request),
			queryFn: () => fetchProtocolTvlBreakdownForDashboard(source.request),
			enabled,
			staleTime: 60 * 60 * 1000,
			refetchOnWindowFocus: false,
			retry: 0
		}))
	})
	const isNetworkLoading = enabled && queries.some((query) => query.isLoading)
	const computeSignature = [
		protocol,
		protocolName,
		chartType,
		sources.map((source) => JSON.stringify(getProtocolTvlBreakdownQueryKey(source.request))).join('|'),
		queries.map((query) => query.dataUpdatedAt).join('|')
	].join('::')
	const latestBreakdowns = useRef<Array<ProtocolTvlBreakdownChart | undefined>>([])
	latestBreakdowns.current = queries.map((query) => query.data)
	const [computed, setComputed] = useState<{ signature: string; data: AdvancedTvlChartData }>({
		signature: '',
		data: EMPTY_ADVANCED_TVL_DATA
	})

	useEffect(() => {
		if (!enabled || isNetworkLoading) return

		let cancelled = false
		const runComputation = () => {
			if (cancelled) return
			const data = buildAdvancedTvlChartData(chartType, sources, latestBreakdowns.current, protocolName)
			if (!cancelled) setComputed({ signature: computeSignature, data })
		}

		let timeoutId: number | undefined
		let idleCallbackId: number | undefined
		if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
			idleCallbackId = window.requestIdleCallback(runComputation, { timeout: 250 })
		} else {
			timeoutId = window.setTimeout(runComputation, 0)
		}

		return () => {
			cancelled = true
			if (idleCallbackId !== undefined && typeof window !== 'undefined') {
				window.cancelIdleCallback(idleCallbackId)
			}
			if (timeoutId !== undefined) window.clearTimeout(timeoutId)
		}
	}, [enabled, isNetworkLoading, computeSignature, chartType, sources, protocolName])

	return {
		data: enabled && computed.signature === computeSignature ? computed.data : EMPTY_ADVANCED_TVL_DATA,
		isLoading: isNetworkLoading || (enabled && computed.signature !== computeSignature),
		sources
	}
}

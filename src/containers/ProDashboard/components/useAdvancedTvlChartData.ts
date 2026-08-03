import { useQueries } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProtocolBreakdownChart } from '~/containers/ProtocolOverview/valueChartSources'
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
	const latestBreakdowns = useRef<Array<ProtocolBreakdownChart | null | undefined>>([])
	latestBreakdowns.current = queries.map((query) => query.data)
	const [computed, setComputed] = useState<{ signature: string; data: AdvancedTvlChartData }>({
		signature: '',
		data: EMPTY_ADVANCED_TVL_DATA
	})

	useEffect(() => {
		if (!canCompute || isNetworkLoading) return

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
	}, [canCompute, isNetworkLoading, computeSignature, chartType, sources, protocolName])

	return {
		data: canCompute && computed.signature === computeSignature ? computed.data : EMPTY_ADVANCED_TVL_DATA,
		isLoading: isNetworkLoading || (canCompute && computed.signature !== computeSignature),
		hasSourceData,
		sources
	}
}

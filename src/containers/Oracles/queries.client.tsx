import { useQueries } from '@tanstack/react-query'
import * as React from 'react'
import { getExtraTvlSeriesSign, getFailedExtraTvlApiKeys, shouldSubtractTvlOverlapSeries } from '~/utils/tvlOverlap'
import {
	fetchOracleChainProtocolBreakdownChart,
	fetchOracleProtocolBreakdownChart,
	fetchOracleProtocolChainBreakdownChart,
	fetchOracleProtocolChart
} from './api'
import type { OracleBreakdownItem } from './types'

export function buildOracleProtocolChainExtraSeries({
	chainBreakdown,
	chain
}: {
	chainBreakdown: Array<OracleBreakdownItem>
	chain: string
}): Array<[number, number]> {
	const series: Array<[number, number]> = []
	for (const row of chainBreakdown) {
		const value = row[chain]
		if (value !== undefined) series.push([row.timestamp, value])
	}
	return series
}

export function useOraclesByChainExtraBreakdowns({
	enabledExtraApiKeys,
	chain
}: {
	enabledExtraApiKeys: string[]
	chain: string | null
}) {
	const extraBreakdownQueries = useQueries({
		queries: enabledExtraApiKeys.map((apiKey) => ({
			queryKey: ['oracles', 'extra-breakdown', chain ?? 'all', apiKey],
			queryFn: () =>
				chain
					? fetchOracleChainProtocolBreakdownChart({ chain, key: apiKey })
					: fetchOracleProtocolBreakdownChart({ key: apiKey }),
			staleTime: 5 * 60 * 1_000,
			refetchOnWindowFocus: false
		}))
	})

	const extraBreakdownsByApiKey = React.useMemo(() => {
		const result: Record<string, Array<OracleBreakdownItem>> = {}
		for (let index = 0; index < enabledExtraApiKeys.length; index++) {
			const apiKey = enabledExtraApiKeys[index]
			const chart = extraBreakdownQueries[index]?.data
			if (apiKey && chart) {
				result[apiKey] = chart
			}
		}
		return result
	}, [enabledExtraApiKeys, extraBreakdownQueries])

	const isFetchingExtraBreakdowns = extraBreakdownQueries.some((query) => query.isLoading || query.isFetching)
	const failedApiKeys = getFailedExtraTvlApiKeys(enabledExtraApiKeys, extraBreakdownQueries)

	return {
		extraBreakdownsByApiKey,
		isFetchingExtraBreakdowns,
		failedApiKeys
	}
}

export function useOracleOverviewExtraSeries({
	enabledExtraApiKeys,
	oracle,
	chain
}: {
	enabledExtraApiKeys: string[]
	oracle: string | null
	chain: string | null
}) {
	const extraChartQueries = useQueries({
		queries: enabledExtraApiKeys.map((key) => ({
			queryKey: ['oracle', 'overview', 'chart', oracle ?? 'unknown', chain ?? 'all', key],
			queryFn: async () => {
				if (!oracle) return []
				if (chain) {
					const chainBreakdown = await fetchOracleProtocolChainBreakdownChart({
						protocol: oracle,
						key
					})
					return buildOracleProtocolChainExtraSeries({ chainBreakdown, chain })
				}
				return fetchOracleProtocolChart({
					protocol: oracle,
					key
				})
			},
			enabled: Boolean(oracle),
			staleTime: 5 * 60 * 1_000,
			refetchOnWindowFocus: false
		}))
	})

	const isFetchingExtraSeries = extraChartQueries.some((query) => query.isLoading || query.isFetching)
	const failedApiKeys = getFailedExtraTvlApiKeys(enabledExtraApiKeys, extraChartQueries)

	const extraTvsByTimestamp = React.useMemo(() => {
		const shouldSubtractOverlapSeries = shouldSubtractTvlOverlapSeries(enabledExtraApiKeys)
		const result = new Map<number, number>()
		for (let index = 0; index < extraChartQueries.length; index++) {
			const query = extraChartQueries[index]
			const apiKey = enabledExtraApiKeys[index]
			if (!query || !apiKey || !query.data) continue
			const data = query.data

			const sign = getExtraTvlSeriesSign({ apiKey, shouldSubtractOverlapSeries })

			for (const [timestampInSeconds, value] of data) {
				const currentByApiKey = result.get(timestampInSeconds) ?? 0
				result.set(timestampInSeconds, currentByApiKey + value * sign)
			}
		}
		return result
	}, [enabledExtraApiKeys, extraChartQueries])

	return {
		isFetchingExtraSeries,
		failedApiKeys,
		extraTvsByTimestamp
	}
}

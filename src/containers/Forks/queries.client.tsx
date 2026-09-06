import { useQueries } from '@tanstack/react-query'
import * as React from 'react'
import { getExtraTvlSeriesSign, getFailedExtraTvlApiKeys, shouldSubtractTvlOverlapSeries } from '~/utils/tvlOverlap'
import { fetchForkProtocolBreakdownChart, fetchForkProtocolChart } from './api'

export function useForksOverviewExtraSeries({ enabledExtraApiKeys }: { enabledExtraApiKeys: Array<string> }) {
	const extraChartQueries = useQueries({
		queries: enabledExtraApiKeys.map((key) => ({
			queryKey: ['forks', 'overview', 'chart', key],
			queryFn: () => fetchForkProtocolBreakdownChart({ key }),
			staleTime: 5 * 60 * 1000,
			refetchOnWindowFocus: false
		}))
	})

	const failedApiKeys = getFailedExtraTvlApiKeys(enabledExtraApiKeys, extraChartQueries)
	const isFetchingExtraSeries = extraChartQueries.some((query) => query.isLoading || query.isFetching)

	const extraBreakdownByTimestamp = React.useMemo(() => {
		const shouldSubtractOverlapSeries = shouldSubtractTvlOverlapSeries(enabledExtraApiKeys)
		const result = new Map<number, Record<string, number>>()

		for (let index = 0; index < extraChartQueries.length; index++) {
			const query = extraChartQueries[index]
			const apiKey = enabledExtraApiKeys[index]
			if (!query || !apiKey) continue
			const data = query.data
			if (!data) continue

			const sign = getExtraTvlSeriesSign({
				apiKey,
				shouldSubtractOverlapSeries
			})

			for (const row of data) {
				const current = result.get(row.timestamp) ?? {}

				for (const key in row) {
					if (key === 'timestamp') continue
					const value = row[key]
					if (value === undefined) continue
					current[key] = (current[key] ?? 0) + value * sign
				}

				result.set(row.timestamp, current)
			}
		}

		return result
	}, [enabledExtraApiKeys, extraChartQueries])

	return {
		failedApiKeys,
		isFetchingExtraSeries,
		extraBreakdownByTimestamp
	}
}

export function useForkByProtocolExtraSeries({
	enabledExtraApiKeys,
	protocol
}: {
	enabledExtraApiKeys: Array<string>
	protocol: string
}) {
	const extraChartQueries = useQueries({
		queries: enabledExtraApiKeys.map((key) => ({
			queryKey: ['forks', 'protocol', 'chart', protocol, key],
			queryFn: () => fetchForkProtocolChart({ protocol, key }),
			staleTime: 5 * 60 * 1000,
			refetchOnWindowFocus: false
		}))
	})

	const failedApiKeys = getFailedExtraTvlApiKeys(enabledExtraApiKeys, extraChartQueries)
	const isFetchingExtraSeries = extraChartQueries.some((query) => query.isLoading || query.isFetching)

	const extraTvsByTimestamp = React.useMemo(() => {
		const shouldSubtractOverlapSeries = shouldSubtractTvlOverlapSeries(enabledExtraApiKeys)
		const result = new Map<number, number>()

		for (let index = 0; index < extraChartQueries.length; index++) {
			const query = extraChartQueries[index]
			const apiKey = enabledExtraApiKeys[index]
			if (!query || !apiKey) continue
			const data = query.data
			if (!data) continue

			const sign = getExtraTvlSeriesSign({
				apiKey,
				shouldSubtractOverlapSeries
			})

			for (const [timestampInSeconds, value] of data) {
				const current = result.get(timestampInSeconds) ?? 0
				result.set(timestampInSeconds, current + value * sign)
			}
		}

		return result
	}, [enabledExtraApiKeys, extraChartQueries])

	return {
		failedApiKeys,
		isFetchingExtraSeries,
		extraTvsByTimestamp
	}
}

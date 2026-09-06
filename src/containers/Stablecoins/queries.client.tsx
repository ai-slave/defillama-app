import { useQuery } from '@tanstack/react-query'
import type {
	StablecoinVolumeChainChartKind,
	StablecoinVolumeGlobalChartKind,
	StablecoinVolumeTokenChartKind
} from '~/containers/Stablecoins/api.types'
import { STABLECOIN_CHART_STALE_TIME } from '~/containers/Stablecoins/chartSeries'
import type {
	StablecoinAssetChartType,
	StablecoinChainsChartType,
	StablecoinChartSeriesPayload,
	StablecoinOverviewChartType,
	StablecoinSeriesSelectionIntent
} from '~/containers/Stablecoins/chartSeries'
import { fetchJson } from '~/utils/async'
import type { StablecoinVolumeChartPayload } from './volumeChart'

type StablecoinMcapSeriesPoint = [number, number]

const buildStablecoinMcapSeries = async (chain: string): Promise<Array<StablecoinMcapSeriesPoint> | null> => {
	try {
		return fetchJson<Array<StablecoinMcapSeriesPoint>>(
			`/api/public/stablecoins/chart?chain=${encodeURIComponent(chain)}`
		)
	} catch (error) {
		console.log(error)
		return null
	}
}
export const useGetStabelcoinsChartDataByChain = (chain?: string) => {
	const { data, isLoading, error } = useQuery({
		queryKey: ['stablecoins', 'chart-by-chain', chain],
		queryFn: chain ? () => buildStablecoinMcapSeries(chain) : () => null,
		staleTime: STABLECOIN_CHART_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!chain
	})

	return { data: data ?? null, error, isLoading }
}

export type StablecoinChartSeriesQuery =
	| {
			scope: 'overview'
			chain: string
			chart: StablecoinOverviewChartType | null
			filters?: Record<string, string | Array<string> | undefined>
			seriesLimit?: number
			selectionIntent?: StablecoinSeriesSelectionIntent
			enabled?: boolean
	  }
	| {
			scope: 'chains'
			chart: StablecoinChainsChartType | null
			includeUnreleased?: boolean
			seriesLimit?: number
			selectionIntent?: StablecoinSeriesSelectionIntent
			enabled?: boolean
	  }
	| {
			scope: 'asset'
			stablecoin: string
			chart: StablecoinAssetChartType | null
			includeUnreleased?: boolean
			seriesLimit?: number
			selectionIntent?: StablecoinSeriesSelectionIntent
			enabled?: boolean
	  }

export const buildStablecoinChartSeriesUrl = (query: StablecoinChartSeriesQuery): string | null => {
	if (!query.chart) return null
	const params = new URLSearchParams({ scope: query.scope, chart: query.chart })
	if (query.seriesLimit != null) params.set('limit', String(query.seriesLimit))
	if (query.selectionIntent) {
		params.set(query.selectionIntent.mode, 'true')
		for (const name of query.selectionIntent.names) params.append('series', name)
	}
	if (query.scope === 'overview') {
		params.set('chain', query.chain)
		const filters = query.filters ?? {}
		for (const key in filters) {
			const value = filters[key]
			if (value === undefined) continue
			if (Array.isArray(value)) {
				for (const item of value) {
					params.append(key, item)
				}
			} else {
				params.set(key, value)
			}
		}
	} else if (query.scope === 'chains') {
		if (query.includeUnreleased) params.set('unreleased', 'true')
	} else if (query.scope === 'asset') {
		params.set('stablecoin', query.stablecoin)
		if (query.includeUnreleased) params.set('unreleased', 'true')
	}
	return `/api/public/stablecoins/chart-series?${params.toString()}`
}

export const fetchStablecoinChartSeriesData = async (
	query: StablecoinChartSeriesQuery
): Promise<StablecoinChartSeriesPayload | null> => {
	const url = buildStablecoinChartSeriesUrl(query)
	return url ? fetchJson<StablecoinChartSeriesPayload>(url) : null
}

export const useStablecoinChartSeriesData = (query: StablecoinChartSeriesQuery) => {
	const { enabled = true, ...queryKey } = query
	return useQuery({
		queryKey: ['stablecoins', 'chart-series', queryKey],
		queryFn: () => fetchStablecoinChartSeriesData(query),
		staleTime: STABLECOIN_CHART_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: enabled && !!query.chart
	})
}

export type StablecoinVolumeChartQuery =
	| {
			scope?: 'global'
			chart: StablecoinVolumeGlobalChartKind | null
			limit?: number
			allSeries?: boolean
			selectionIntent?: StablecoinSeriesSelectionIntent
			enabled?: boolean
	  }
	| {
			scope: 'chain'
			chain: string
			chart: StablecoinVolumeChainChartKind | null
			limit?: number
			allSeries?: boolean
			selectionIntent?: StablecoinSeriesSelectionIntent
			enabled?: boolean
	  }
	| {
			scope: 'token'
			token: string | null
			chart: StablecoinVolumeTokenChartKind | null
			limit?: number
			allSeries?: boolean
			selectionIntent?: StablecoinSeriesSelectionIntent
			enabled?: boolean
	  }

export const buildStablecoinVolumeChartUrl = (query: StablecoinVolumeChartQuery): string | null => {
	if (!query.chart) return null
	const params = new URLSearchParams({
		scope: query.scope ?? 'global',
		chart: query.chart,
		...(query.allSeries ? { all: 'true' } : { limit: String(query.limit ?? 20) })
	})
	if (query.selectionIntent) {
		params.set(query.selectionIntent.mode, 'true')
		for (const name of query.selectionIntent.names) params.append('series', name)
	}
	if (query.scope === 'chain') {
		params.set('chain', query.chain)
	} else if (query.scope === 'token') {
		if (!query.token) return null
		params.set('token', query.token)
	}
	return `/api/public/stablecoins/volume-chart?${params.toString()}`
}

export const fetchStablecoinVolumeChartData = async (
	query: StablecoinVolumeChartQuery
): Promise<StablecoinVolumeChartPayload | null> => {
	const url = buildStablecoinVolumeChartUrl(query)
	return url ? fetchJson<StablecoinVolumeChartPayload>(url) : null
}

export const useStablecoinVolumeChartData = (query: StablecoinVolumeChartQuery) => {
	const { enabled = true, ...queryKey } = query
	const url = buildStablecoinVolumeChartUrl(query)
	return useQuery({
		queryKey: ['stablecoins', 'volume-chart', queryKey],
		queryFn: () => fetchStablecoinVolumeChartData(query),
		staleTime: STABLECOIN_CHART_STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: enabled && !!url
	})
}

import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import {
	fetchRWABreakdownViaProxy,
	fetchRWAAssetChartViaProxy,
	fetchRWAAssetsListViaProxy
} from '~/containers/ProDashboard/services/fetchViaProxy'
import {
	fetchRWAActiveTVLs,
	fetchRWAAssetChartData,
	fetchRWAChainBreakdownChartData,
	fetchRWACategoryBreakdownChartData,
	fetchRWAPlatformBreakdownChartData,
	fetchRWAAssetGroupBreakdownChartData,
	fetchRWAChartDataByAsset
} from '~/containers/RWA/api'
import type { IFetchedRWAProject } from '~/containers/RWA/api.types'
import { toBreakdownChartDataset } from '~/containers/RWA/breakdownDataset'
import { tokenIconUrl } from '~/utils/icons'
import { getProRwaBreakdown, getProRwaBreakdownQueryKey } from '../../../rwaBreakdown'
import type { RWAOverviewChartBreakdown, RWAOverviewChartMetric } from '../../../types'

const STALE_TIME = 60 * 60 * 1000

function getBreakdownFetcher(breakdown: RWAOverviewChartBreakdown) {
	switch (breakdown) {
		case 'chain':
			return fetchRWAChainBreakdownChartData
		case 'category':
			return fetchRWACategoryBreakdownChartData
		case 'platform':
			return fetchRWAPlatformBreakdownChartData
		case 'assetGroup':
			return fetchRWAAssetGroupBreakdownChartData
		default:
			return fetchRWAChainBreakdownChartData
	}
}

export function useRWABreakdownChartData(
	breakdown: RWAOverviewChartBreakdown,
	metric: RWAOverviewChartMetric,
	chain?: string
) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const actualBreakdown = getProRwaBreakdown(breakdown)
	const isChainSpecific = chain && chain !== 'All'

	const { data, isLoading, error } = useQuery({
		queryKey: getProRwaBreakdownQueryKey(actualBreakdown, metric, chain),
		enabled: streamDone,
		queryFn: async () => {
			if (isChainSpecific) {
				if (authToken) {
					return fetchRWABreakdownViaProxy(actualBreakdown, metric, authToken, chain)
				}
				const assetData = await fetchRWAChartDataByAsset({
					target: { kind: 'chain', slug: chain },
					includeStablecoins: false,
					includeGovernance: false
				})
				if (!assetData) return null
				return assetData[metric] ?? null
			}

			if (authToken) {
				return fetchRWABreakdownViaProxy(actualBreakdown, metric, authToken)
			}
			const fetcher = getBreakdownFetcher(actualBreakdown)
			return fetcher({
				key: metric,
				includeStablecoin: false,
				includeGovernance: false
			})
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const chartDataset = useMemo(() => {
		if (!data) return null
		return toBreakdownChartDataset(data)
	}, [data])

	return { chartDataset, isLoading, error }
}

export function useRWAChainsList() {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)

	const { data, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'rwa-chains-list'],
		enabled: streamDone,
		queryFn: async () => {
			if (authToken) {
				return fetchRWABreakdownViaProxy('chain', 'activeMcap', authToken)
			}
			return fetchRWAChainBreakdownChartData({
				key: 'activeMcap',
				includeStablecoin: false,
				includeGovernance: false
			})
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const chains = useMemo(() => {
		if (!data || data.length === 0) return []
		const lastRow = data[data.length - 1]
		const chains: Array<{ chain: string; tvl: number }> = []
		for (const chain in lastRow) {
			if (chain === 'timestamp') continue
			const tvl = lastRow[chain]
			if (tvl > 0) chains.push({ chain, tvl })
		}
		chains.sort((a, b) => b.tvl - a.tvl)
		return chains
	}, [data])

	return { chains, isLoading }
}

export function useRWAAssetChartData(assetId: string | null) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)

	const { data, isLoading, error } = useQuery({
		queryKey: ['pro-dashboard', 'rwa-asset-chart', assetId],
		enabled: streamDone && !!assetId,
		queryFn: async () => {
			if (authToken) {
				return fetchRWAAssetChartViaProxy(assetId!, authToken)
			}
			return fetchRWAAssetChartData(assetId!)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	return { chartDataset: data ?? null, isLoading, error }
}

export type RWAAssetOption = {
	id: string
	ticker: string
	assetName: string | null
	iconUrl: string | null
	totalActiveMcap: number
}

function getTotalFromMap(map: Record<string, number> | null | undefined): number {
	if (!map) return 0
	let total = 0
	for (const chain in map) total += map[chain]
	return total
}

function resolveIconUrl(asset: IFetchedRWAProject): string | null {
	if (asset.coingeckoId) return tokenIconUrl(asset.coingeckoId)
	const logo = asset.logo
	if (!logo || !logo.startsWith('http')) return null
	return logo
}

export function useRWAAssetsList() {
	const authToken = useContext(ProxyAuthTokenContext)

	const { data, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'rwa-assets-list'],
		queryFn: async () => {
			if (authToken) {
				return fetchRWAAssetsListViaProxy(authToken)
			}
			return fetchRWAActiveTVLs()
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const assets: RWAAssetOption[] = useMemo(() => {
		if (!data) return []
		const assets: RWAAssetOption[] = []
		for (const asset of data) {
			if (!asset.id || !asset.ticker || asset.stablecoin || asset.governance) continue
			assets.push({
				id: asset.id,
				ticker: asset.ticker,
				assetName: asset.assetName ?? null,
				iconUrl: resolveIconUrl(asset),
				totalActiveMcap: getTotalFromMap(asset.activeMcap)
			})
		}
		assets.sort((a, b) => b.totalActiveMcap - a.totalActiveMcap)
		return assets
	}, [data])

	return { assets, isLoading }
}

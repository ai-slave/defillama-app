import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchProDashboardProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import {
	fetchRWAActiveTVLs,
	fetchRWAAssetChartData,
	fetchRWAChainBreakdownChartData,
	fetchRWACategoryBreakdownChartData,
	fetchRWAPlatformBreakdownChartData,
	fetchRWAAssetGroupBreakdownChartData,
	fetchRWAChartMetricDataByAsset
} from '~/containers/RWA/api'
import type { IFetchedRWAProject, RWAOverviewBreakdownRequest } from '~/containers/RWA/api.types'
import { toRwaPositionalChartDataset } from '~/containers/RWA/breakdownDataset'
import { tokenIconUrl } from '~/utils/icons'
import { getProRwaBreakdownQueryKey } from '../../../rwaBreakdown'
import { sumRwaMetricBreakdown } from '../../../rwaMetrics'
import type { RWAOverviewChartBreakdown, RWAOverviewChartMetric } from '../../../types'

const STALE_TIME = 60 * 60 * 1000

const RWA_BREAKDOWN_FETCHERS = {
	chain: fetchRWAChainBreakdownChartData,
	category: fetchRWACategoryBreakdownChartData,
	platform: fetchRWAPlatformBreakdownChartData,
	assetGroup: fetchRWAAssetGroupBreakdownChartData
} satisfies Record<RWAOverviewBreakdownRequest['breakdown'], typeof fetchRWAChainBreakdownChartData>

export function useRWABreakdownChartData(
	breakdown: RWAOverviewChartBreakdown,
	metric: RWAOverviewChartMetric,
	chain?: string
) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const selectedChain = chain && chain !== 'All' ? chain : null

	const { data, isLoading, error } = useQuery({
		queryKey: getProRwaBreakdownQueryKey(breakdown, metric, chain),
		enabled: streamDone,
		queryFn: async () => {
			if (selectedChain) {
				if (authToken) {
					return fetchProDashboardProxy('rwaBreakdown', { breakdown, metric, chain: selectedChain }, authToken)
				}
				const rows = await fetchRWAChartMetricDataByAsset({
					target: { kind: 'chain', slug: selectedChain },
					metric,
					includeStablecoins: false,
					includeGovernance: false
				})
				return toRwaPositionalChartDataset(rows)
			}

			if (authToken) {
				return fetchProDashboardProxy('rwaBreakdown', { breakdown, metric }, authToken)
			}
			const fetcher = RWA_BREAKDOWN_FETCHERS[breakdown]
			const rows = await fetcher({
				key: metric,
				includeStablecoin: false,
				includeGovernance: false
			})
			return toRwaPositionalChartDataset(rows)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	return { chartDataset: data ?? null, isLoading: isLoading || (!streamDone && data === undefined), error }
}

export function useRWAChainsList() {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)

	const { data, isLoading } = useQuery({
		queryKey: ['pro-dashboard', 'rwa-chains-list'],
		enabled: streamDone,
		queryFn: async () => {
			if (authToken) {
				return fetchProDashboardProxy('rwaBreakdown', { breakdown: 'chain', metric: 'activeMcap' }, authToken)
			}
			const rows = await fetchRWAChainBreakdownChartData({
				key: 'activeMcap',
				includeStablecoin: false,
				includeGovernance: false
			})
			return toRwaPositionalChartDataset(rows)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const chains = useMemo(() => {
		if (!data || data.source.length === 0) return []
		const lastRow = data.source.at(-1)
		if (!lastRow) return []
		const chains: Array<{ chain: string; tvl: number }> = []
		for (const [index, chain] of data.dimensions.entries()) {
			if (index === 0) continue
			const tvl = lastRow[index]
			if (typeof tvl === 'number' && tvl > 0) chains.push({ chain, tvl })
		}
		chains.sort((a, b) => b.tvl - a.tvl)
		return chains
	}, [data])

	return { chains, isLoading: isLoading || (!streamDone && data === undefined) }
}

export function useRWAAssetChartData(assetId: string | null) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)

	const { data, isLoading, error } = useQuery({
		queryKey: ['pro-dashboard', 'rwa-asset-chart', assetId],
		enabled: streamDone && !!assetId,
		queryFn: async () => {
			if (!assetId) throw new Error('Missing RWA asset ID')
			if (authToken) {
				return fetchProDashboardProxy('rwaAssetChart', { assetId }, authToken)
			}
			return fetchRWAAssetChartData(assetId)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	return {
		chartDataset: data ?? null,
		isLoading: isLoading || (assetId !== null && !streamDone && data === undefined),
		error
	}
}

export type RWAAssetOption = {
	id: string
	ticker: string
	assetName: string | null
	iconUrl: string | null
	totalActiveMcap: number | null
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
				return fetchProDashboardProxy('rwaAssetsList', {}, authToken)
			}
			return fetchRWAActiveTVLs()
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const assets: Array<RWAAssetOption> = useMemo(() => {
		if (!data) return []
		const assets: Array<RWAAssetOption> = []
		for (const asset of data) {
			if (!asset.id || !asset.ticker || asset.stablecoin || asset.governance) continue
			assets.push({
				id: asset.id,
				ticker: asset.ticker,
				assetName: asset.assetName ?? null,
				iconUrl: resolveIconUrl(asset),
				totalActiveMcap: sumRwaMetricBreakdown(asset.activeMcap)
			})
		}
		assets.sort((a, b) => {
			if (a.totalActiveMcap === null) return b.totalActiveMcap === null ? 0 : 1
			if (b.totalActiveMcap === null) return -1
			return b.totalActiveMcap - a.totalActiveMcap
		})
		return assets
	}, [data])

	return { assets, isLoading }
}

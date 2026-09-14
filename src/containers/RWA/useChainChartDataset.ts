import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { IRWAAssetsOverview, IRWAChartMetricRows, RWAAssetChartTarget, RWAChartMetricKey } from './api.types'
import { foldRwaChainSeries, rankRwaChains, type RWAChainHistory } from './chainFold'
import type { RWAPositionalChartDataset } from './chartDataset'
import { fetchRwaAssetChartData, getRwaAssetChartQueryKey } from './hooks'
import { rwaSlug } from './rwaSlug'

const EMPTY_DATASET: RWAPositionalChartDataset = { source: [], dimensions: ['timestamp'] }
const STALE_TIME = 60 * 60 * 1000

export type RwaChainChartDatasetRequest = {
	metric: RWAChartMetricKey
	/** The page's assets after its filters; the chain lines sum over these. */
	assets: IRWAAssetsOverview['assets']
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	/** The page total on the metric, the axis the chain lines follow. */
	total: RWAPositionalChartDataset
	enabled: boolean
}

type ChainQueries = {
	/** One entry per chain, in ranking order; undefined until that history has loaded. */
	rows: Array<IRWAChartMetricRows | undefined>
	/** Every history has loaded or failed. */
	settled: boolean
	isLoading: boolean
	failed: number
	firstError: unknown
}

/** A stable reference so React Query reuses the combined result while the histories do not change. */
function combineChainQueries(results: Array<UseQueryResult<IRWAChartMetricRows>>): ChainQueries {
	return {
		rows: results.map((result) => result.data),
		settled: results.every((result) => result.data !== undefined || result.error != null),
		isLoading: results.some((result) => result.isLoading),
		failed: results.filter((result) => result.error != null).length,
		firstError: results.find((result) => result.error != null)?.error ?? null
	}
}

/**
 * The chart's chain series when the build-time fold does not apply: one per-chain history per drawn chain,
 * folded over the page's assets. Each history is a few MB, so the hook runs only while the chart shows chains.
 * A chain whose history fails lands in Others, as at build time; the chart errors only when every chain failed.
 */
export function useRwaChainChartDataset({
	metric,
	assets,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl,
	total,
	enabled
}: RwaChainChartDatasetRequest): {
	chartDataset: RWAPositionalChartDataset
	isChartLoading: boolean
	chartError: string | null
} {
	const chains = useMemo(() => (enabled ? rankRwaChains(assets, metric) : []), [assets, enabled, metric])
	const queries = useQueries({
		queries: chains.map((chain) => {
			const target: RWAAssetChartTarget = { kind: 'chain', slug: rwaSlug(chain) }
			return {
				queryKey: getRwaAssetChartQueryKey(target, metric, includeStablecoins, includeGovernance, includeBridgeTvl),
				queryFn: () =>
					fetchRwaAssetChartData({ key: metric, target, includeStablecoins, includeGovernance, includeBridgeTvl }),
				staleTime: STALE_TIME,
				refetchOnWindowFocus: false,
				retry: 1,
				enabled
			}
		}),
		combine: combineChainQueries
	})
	const { rows, settled, isLoading, failed, firstError } = queries
	const histories = useMemo<Array<RWAChainHistory> | null>(() => {
		if (!settled) return null
		const loaded: Array<RWAChainHistory> = []
		for (const [index, chain] of chains.entries()) {
			const chainRows = rows[index]
			if (chainRows !== undefined) loaded.push({ chain, rows: chainRows })
		}
		return loaded
	}, [chains, rows, settled])
	const allFailed = enabled && settled && chains.length > 0 && failed === chains.length
	const chartDataset = useMemo(
		() =>
			enabled && histories && !allFailed ? foldRwaChainSeries({ chains: histories, assets, total }) : EMPTY_DATASET,
		[allFailed, assets, enabled, histories, total]
	)
	const chartError = allFailed
		? firstError instanceof Error
			? firstError.message
			: 'Failed to load chain data.'
		: null
	return { chartDataset, isChartLoading: enabled && isLoading, chartError }
}

import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { mergeFailedReads, queryReadFailed, type QueryRetry } from '~/utils/query'
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

export type ChainQueries = {
	/** One entry per chain, in ranking order; undefined until that history has loaded. */
	rows: Array<IRWAChartMetricRows | undefined>
	/** Every history has loaded or failed. */
	settled: boolean
	isLoading: boolean
	/** One Try again over the histories whose read failed; null when none failed. */
	failedRead: QueryRetry | null
	failed: number
}

/** A stable reference so React Query reuses the combined result while the histories do not change. A failed history
    counts as failed while its retry runs, so the chart keeps its error and Try again until a history loads. */
export function combineChainQueries(
	results: Array<
		Pick<
			UseQueryResult<IRWAChartMetricRows>,
			'data' | 'isLoading' | 'isFetching' | 'errorUpdatedAt' | 'dataUpdatedAt' | 'refetch'
		>
	>
): ChainQueries {
	const failed = results.filter(queryReadFailed)
	return {
		rows: results.map((result) => result.data),
		settled: results.every((result) => result.data !== undefined || queryReadFailed(result)),
		isLoading: results.some((result) => result.isLoading),
		failedRead: mergeFailedReads(failed),
		failed: failed.length
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
	failedRead: QueryRetry | null
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
	return useMemo(
		() => buildRwaChainChartDataset({ enabled, chains, queries, assets, total }),
		[assets, chains, enabled, queries, total]
	)
}

/** Folds the per-chain histories once all have settled; a failed chain lands in Others, and all failing is an error. */
export function buildRwaChainChartDataset({
	enabled,
	chains,
	queries,
	assets,
	total
}: {
	enabled: boolean
	chains: Array<string>
	queries: ChainQueries
	assets: IRWAAssetsOverview['assets']
	total: RWAPositionalChartDataset
}): {
	chartDataset: RWAPositionalChartDataset
	isChartLoading: boolean
	failedRead: QueryRetry | null
} {
	const { rows, settled, isLoading, failed, failedRead } = queries
	const isChartLoading = enabled && isLoading
	if (!enabled || !settled) return { chartDataset: EMPTY_DATASET, isChartLoading, failedRead: null }
	if (chains.length > 0 && failed === chains.length) {
		return { chartDataset: EMPTY_DATASET, isChartLoading, failedRead }
	}
	const histories: Array<RWAChainHistory> = []
	for (const [index, chain] of chains.entries()) {
		const chainRows = rows[index]
		if (chainRows !== undefined) histories.push({ chain, rows: chainRows })
	}
	return { chartDataset: foldRwaChainSeries({ chains: histories, assets, total }), isChartLoading, failedRead: null }
}

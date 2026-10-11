import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { QueryRetry } from '~/utils/query'
import type { IRWAAssetsOverview, RWAAssetChartTarget } from '../api.types'
import { rankRwaChains, type RWAChainHistory } from '../chainFold'
import type { RWAChartRow } from '../chartDataset'
import { fetchRwaAssetChartData, getRwaAssetChartQueryKey } from '../hooks'
import { rwaSlug } from '../rwaSlug'
import { combineChainQueries } from '../useChainChartDataset'
import { foldRwaChainHistories } from './chainChangeCard'

const METRIC = 'activeMcap'
const STALE_TIME = 60 * 60 * 1000

export type RwaChainChangeRows = {
	/** Null until every history has settled, or when every one failed. */
	rows: Array<RWAChartRow> | null
	isLoading: boolean
	failedRead: QueryRetry | null
}

/**
 * Change by Chain under a filter: the per-chain histories the chart loads under Group by Chain (the same queries, so
 * they load once), summed over the page's filtered assets. Loading until every history settled; a failed chain stays
 * out, and the card errors only when every chain failed, as the chart does.
 */
export function useRwaChainChangeRows({
	assets,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl,
	enabled
}: {
	assets: IRWAAssetsOverview['assets']
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	enabled: boolean
}): RwaChainChangeRows {
	const chains = useMemo(() => (enabled ? rankRwaChains(assets, METRIC) : []), [assets, enabled])
	const histories = useQueries({
		queries: chains.map((chain) => {
			const target: RWAAssetChartTarget = { kind: 'chain', slug: rwaSlug(chain) }
			return {
				queryKey: getRwaAssetChartQueryKey(target, METRIC, includeStablecoins, includeGovernance, includeBridgeTvl),
				queryFn: () =>
					fetchRwaAssetChartData({ key: METRIC, target, includeStablecoins, includeGovernance, includeBridgeTvl }),
				staleTime: STALE_TIME,
				refetchOnWindowFocus: false,
				retry: 1,
				enabled
			}
		}),
		combine: combineChainQueries
	})
	return useMemo((): RwaChainChangeRows => {
		if (histories.failedRead && histories.failed === chains.length) {
			return { rows: null, isLoading: false, failedRead: histories.failedRead }
		}
		if (!histories.settled) return { rows: null, isLoading: true, failedRead: null }
		const found: Array<RWAChainHistory> = []
		for (const [index, chain] of chains.entries()) {
			const rows = histories.rows[index]
			if (rows !== undefined) found.push({ chain, rows })
		}
		return { rows: foldRwaChainHistories(found, assets), isLoading: false, failedRead: null }
	}, [assets, chains, histories])
}

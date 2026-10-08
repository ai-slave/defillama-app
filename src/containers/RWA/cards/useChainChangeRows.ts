import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { IRWAAssetsOverview, RWAAssetChartTarget } from '../api.types'
import { rankRwaChains, type RWAChainHistory } from '../chainFold'
import type { RWAChartRow } from '../chartDataset'
import { fetchRwaAssetChartData, getRwaAssetChartQueryKey } from '../hooks'
import { rwaSlug } from '../rwaSlug'
import { combineChainQueries } from '../useChainChartDataset'
import { foldRwaChainHistories } from './chainChangeCard'

const METRIC = 'activeMcap'
const STALE_TIME = 60 * 60 * 1000

/**
 * Change by Chain under a filter: the per-chain histories the chart loads under Group by Chain (the same queries, so
 * they load once), summed over the page's filtered assets. Null until every history settled; a failed chain stays out.
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
}): { rows: Array<RWAChartRow> | null; isLoading: boolean } {
	const chains = useMemo(() => (enabled ? rankRwaChains(assets, METRIC) : []), [assets, enabled])
	const queries = useQueries({
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
	return useMemo(() => {
		if (!enabled || !queries.settled) return { rows: null, isLoading: enabled && queries.isLoading }
		const histories: Array<RWAChainHistory> = []
		for (const [index, chain] of chains.entries()) {
			const rows = queries.rows[index]
			if (rows !== undefined) histories.push({ chain, rows })
		}
		return { rows: foldRwaChainHistories(histories, assets), isLoading: false }
	}, [assets, chains, enabled, queries])
}

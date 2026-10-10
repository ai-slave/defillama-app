import { APY_QUICK_PICK_LADDER, inRange, rangeQuickPicks, USD_QUICK_PICK_LADDER } from '~/components/Filters/quickPicks'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { formatPercent } from '~/utils/numberFormat'
import type { TokenYieldStats } from './yieldStats'

// Client-side chain/TVL/APY filters over the earn rows (the rows are already
// scoped to the page token server-side via the resolved token option keys).
export const TOKEN_YIELDS_FILTER_QUERY_PARAMS = ['chain', 'excludeChain', 'minTvl', 'maxTvl', 'minApy', 'maxApy']

/** Column-visibility params share the query string but are not filters. */
export function hasActiveTokenYieldsFilters(query: Record<string, string | Array<string> | undefined>) {
	return TOKEN_YIELDS_FILTER_QUERY_PARAMS.some((key) => {
		const value = query[key]
		return Array.isArray(value) ? value.length > 0 : value != null && value !== ''
	})
}

export function filterTokenYieldPools({
	pools,
	chainCount,
	selectedChains,
	minTvl,
	maxTvl,
	minApy,
	maxApy
}: {
	pools: Array<IYieldTableRow>
	chainCount: number
	selectedChains: Array<string>
	minTvl: number | null
	maxTvl: number | null
	minApy: number | null
	maxApy: number | null
}) {
	// Every chain selected means no chain filter; Deselect All keeps no pools.
	const chainSet = selectedChains.length < chainCount ? new Set(selectedChains) : null
	const filtered: Array<IYieldTableRow> = []
	const tvlValues: Array<number | null> = []
	const apyValues: Array<number | null> = []
	for (const pool of pools) {
		if (chainSet && !chainSet.has(pool.chains[0])) continue
		const inTvlRange = inRange(pool.tvl, minTvl, maxTvl)
		const inApyRange = inRange(pool.apy, minApy, maxApy)
		// A range's chips count the pools every other filter keeps, so applying one leaves its own chips in place.
		if (inApyRange) tvlValues.push(pool.tvl)
		if (inTvlRange) apyValues.push(pool.apy)
		if (inTvlRange && inApyRange) filtered.push(pool)
	}
	return {
		pools: filtered,
		tvlQuickPicks: rangeQuickPicks(USD_QUICK_PICK_LADDER, tvlValues),
		apyQuickPicks: rangeQuickPicks(APY_QUICK_PICK_LADDER, apyValues)
	}
}

/** A partial count means only the hydrated first page is loaded, so the total comes from the snapshot. */
export function formatTokenYieldsSummary({
	stats,
	totalRowCount,
	isPartial
}: {
	stats: TokenYieldStats
	totalRowCount: number
	isPartial: boolean
}) {
	if (stats.noOfPoolsTracked === 0) return null
	if (isPartial) return `Showing ${stats.noOfPoolsTracked} of ${totalRowCount} ${totalRowCount > 1 ? 'pools' : 'pool'}`
	const averageApy =
		stats.averageAPY != null
			? `, average APY ${formatPercent(stats.averageAPY, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
			: ''
	return `Tracking ${stats.noOfPoolsTracked} ${stats.noOfPoolsTracked > 1 ? 'pools' : 'pool'}${averageApy}`
}

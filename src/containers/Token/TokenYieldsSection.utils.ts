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
	let filtered = pools

	// Selecting every chain, or none, means no chain filter.
	if (selectedChains.length > 0 && selectedChains.length < chainCount) {
		const chainSet = new Set(selectedChains)
		filtered = filtered.filter((pool) => chainSet.has(pool.chains[0]))
	}
	if (minTvl != null) filtered = filtered.filter((pool) => pool.tvl != null && pool.tvl >= minTvl)
	if (maxTvl != null) filtered = filtered.filter((pool) => pool.tvl != null && pool.tvl <= maxTvl)
	if (minApy != null) filtered = filtered.filter((pool) => pool.apy != null && pool.apy >= minApy)
	if (maxApy != null) filtered = filtered.filter((pool) => pool.apy != null && pool.apy <= maxApy)

	return filtered
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

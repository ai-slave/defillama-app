import { useMemo } from 'react'
import { queryReadFailed, type QueryRetry } from '~/utils/query'
import type { RWAOverviewDisplayRow } from './api.types'
import type { RWAPerpsChartMetric } from './chartBreakdown'
import type { RWAChartDataset, RWAChartRow } from './chartDataset'
import { getRwaGroupMemberships, type RWAGroupBy } from './table/groupBy'
import { buildRwaLeafRows } from './table/rows'
import { getRwaPerpsChartUrl, useRwaPerpsChartQuery, type RwaPerpsChartScope } from './usePerpsChartDataset'

/* The per-market history of a Perps page folded in the browser: what a chart or a card draws once a filter narrows
   the markets, since the server splits only know the scope. Pure up to the hook: the hook loads, the fold sums. */

/** Each perps row's group under the table's Group by, as the table labels it; under None each market is its own. */
export function getRwaPerpsMarketGroups(
	rows: ReadonlyArray<RWAOverviewDisplayRow>,
	groupBy: RWAGroupBy
): Map<string, string> {
	const perps = rows.filter((row) => row.kind === 'perps')
	const groups = new Map<string, string>()
	if (groupBy === 'none') {
		for (const row of perps) groups.set(row.id, row.id)
		return groups
	}
	for (const leaf of buildRwaLeafRows(perps, { includeBridgeTvl: true })) {
		const [membership] = getRwaGroupMemberships(leaf, groupBy)
		if (membership) groups.set(leaf.asset.id, membership.label)
	}
	return groups
}

/**
 * Sums the per-market history by the Group by over the page's markets, the filtered ones when `marketIds` is set.
 * A market without a row on the page (delisted, or outside the filters) stays out; a group's day with no member
 * value is unknown, not zero. Groups come largest first by their latest value, as the server splits order them.
 */
export function foldRwaPerpsMarketHistory(
	history: RWAChartDataset,
	rows: ReadonlyArray<RWAOverviewDisplayRow>,
	groupBy: RWAGroupBy,
	marketIds: ReadonlyArray<string> | null
): RWAChartDataset {
	const groups = getRwaPerpsMarketGroups(rows, groupBy)
	const wanted = marketIds ? new Set(marketIds) : null
	const members = new Map<string, Array<string>>()
	for (const series of history.dimensions) {
		const group = groups.get(series)
		if (series === 'timestamp' || group == null || (wanted && !wanted.has(series))) continue
		const names = members.get(group)
		if (names) names.push(series)
		else members.set(group, [series])
	}
	const source = history.source.map((row) => {
		const next: RWAChartRow = { timestamp: row.timestamp }
		for (const [group, series] of members) {
			let sum: number | null = null
			for (const name of series) {
				const value = row[name]
				if (value != null) sum = (sum ?? 0) + value
			}
			next[group] = sum
		}
		return next
	})
	const latest = (group: string) => {
		for (let index = source.length - 1; index >= 0; index--) {
			const value = source[index]![group]
			if (value != null) return value
		}
		return 0
	}
	const names = [...members.keys()].sort((a, b) => latest(b) - latest(a) || a.localeCompare(b))
	return { dimensions: ['timestamp', ...names], source }
}

/** One group per key, its known points oldest first, timestamps as the route sends them (ms). */
export function toRwaPerpsHistorySeries(dataset: RWAChartDataset): Record<string, Array<[number, number]>> {
	const series: Record<string, Array<[number, number]>> = {}
	for (const name of dataset.dimensions.slice(1)) {
		const points: Array<[number, number]> = []
		for (const row of dataset.source) {
			const value = row[name]
			if (value != null) points.push([row.timestamp, value])
		}
		series[name] = points
	}
	return series
}

type RwaPerpsHistoryRequest = {
	scope: RwaPerpsChartScope
	metric: RWAPerpsChartMetric
	groupBy: RWAGroupBy
	/** The `id` of the page's filtered perps rows; null means unfiltered. */
	marketIds: ReadonlyArray<string> | null
	/** The page's rows, which name each market's group; the route carries market ids only. */
	rows: ReadonlyArray<RWAOverviewDisplayRow>
	includeCex: boolean
	enabled: boolean
}

/** The per-market history of the scope, loaded once per metric and folded by the Group by over the filtered markets. */
export function useRwaPerpsHistoryDataset({
	scope,
	metric,
	groupBy,
	marketIds,
	rows,
	includeCex,
	enabled
}: RwaPerpsHistoryRequest): { dataset: RWAChartDataset | null; isLoading: boolean; failedRead: QueryRetry | null } {
	// The per-market route of the scope: contract-breakdown, or market-breakdown on an underlying.
	const query = useRwaPerpsChartQuery(
		getRwaPerpsChartUrl({ source: { kind: 'contracts' }, metric, includeCex, scope }),
		enabled
	)
	const data = query.data
	const dataset = useMemo(
		() => (enabled && data ? foldRwaPerpsMarketHistory(data, rows, groupBy, marketIds) : null),
		[data, enabled, groupBy, marketIds, rows]
	)
	return {
		dataset,
		isLoading: enabled && query.isLoading,
		failedRead: enabled && queryReadFailed(query) ? query : null
	}
}

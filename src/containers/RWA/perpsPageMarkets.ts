import type { NextRouter } from 'next/router'
import type { RWAOverviewDisplayRow } from './api.types'
import { filterRwaPerpsRows, type RWAPerpsFilterDefinition } from './perpsFilters'

/**
 * A Perps page's markets under its filters: the table lists every one (`filteredAssets`); Key Metrics, the cards and
 * the chart fold `aggregateAssets`, which leaves out suspicious markets as the Assets totals leave out suspicious
 * assets. The names match useFilteredRwaAssets, the Assets tree's split.
 */
export function filterRwaPerpsPageMarkets(
	markets: Array<RWAOverviewDisplayRow>,
	query: NextRouter['query'],
	filters: ReadonlyArray<RWAPerpsFilterDefinition>
) {
	const filteredAssets = filterRwaPerpsRows(markets, query, filters)
	return { filteredAssets, aggregateAssets: filteredAssets.filter((market) => !market.suspicious) }
}

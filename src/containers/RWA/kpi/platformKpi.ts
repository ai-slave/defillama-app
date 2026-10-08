import type { RWAOverviewDisplayRow } from '../api.types'
import { rankRwaDefiProtocols, type RwaNamedBar } from '../cards/cardData'
import { applyDefaultAssetFilters } from '../chartAggregation'
import type { RWAOverviewInclusionDefaults } from '../constants'
import type { RWAEntityView } from '../PlatformPage/view'
import { aggregateRwaGroupMetrics, collectRwaGroupDistinct, tallyRwaGroupFlags } from '../table/grouping'
import {
	buildRwaLeafRows,
	type RWAGroupDistinct,
	type RWAGroupFlags,
	type RWALeafRowOptions,
	type RWATableMetrics
} from '../table/rows'

export type RWAPlatformKpi = {
	/** The same fold a group row uses, over the rows the view folds (getRwaPlatformFold). */
	metrics: RWATableMetrics
	flags: RWAGroupFlags
	distinct: RWAGroupDistinct
	largestProtocol: RwaNamedBar | null
	permissionlessCount: number
	/** Active mcap per issuer, largest first; unpriced rows count as zero so every issuer is listed. */
	issuersByMcap: Array<RwaNamedBar>
}

/** The rows a platform's card and Information chart fold, and the Include in TVL toggles they read. */
type RWAPlatformFold = {
	aggregateAssets: Array<RWAOverviewDisplayRow>
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	/** A toggle or a filter differs from the page defaults, so the chart cannot draw its build-time dataset. */
	activeFilters: boolean
}

/**
 * Information describes the whole platform, as a venue's does: every spot row the page holds at its default Include
 * in TVL, whatever filters the address carries over from the Assets view, which draws no strip there. The Assets view
 * folds the rows its table shows.
 */
export function getRwaPlatformFold(
	view: RWAEntityView,
	assets: Array<RWAOverviewDisplayRow>,
	defaultInclusion: RWAOverviewInclusionDefaults,
	filtered: RWAPlatformFold
): RWAPlatformFold {
	if (view !== 'information') return filtered
	const { includeStablecoins, includeGovernance } = defaultInclusion
	return {
		aggregateAssets: applyDefaultAssetFilters(assets, {
			includeStablecoins,
			includeGovernance,
			includeWrappers: defaultInclusion.includeWrappers ?? false
		}),
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl: defaultInclusion.includeBridgeTvl ?? true,
		activeFilters: false
	}
}

/**
 * Every number the platform header shows, from the rows it is given with the table's options (bridges, the flow
 * summary); the index's own AUM is not read.
 */
export function foldRwaPlatformKpi(assets: Array<RWAOverviewDisplayRow>, options: RWALeafRowOptions): RWAPlatformKpi {
	const rows = buildRwaLeafRows(assets, options)
	let permissionlessCount = 0
	const issuerMcap = new Map<string, number>()
	for (const asset of assets) {
		if (asset.accessModel === 'Permissionless') permissionlessCount += 1
		if (asset.issuer) issuerMcap.set(asset.issuer, (issuerMcap.get(asset.issuer) ?? 0) + (asset.activeMcap?.total ?? 0))
	}
	return {
		metrics: aggregateRwaGroupMetrics(rows),
		flags: tallyRwaGroupFlags(rows),
		distinct: collectRwaGroupDistinct(rows),
		largestProtocol: rankRwaDefiProtocols(assets, options.includeBridgeTvl, 1)[0] ?? null,
		permissionlessCount,
		issuersByMcap: Array.from(issuerMcap, ([name, value]) => ({ name, value })).sort(
			(a, b) => b.value - a.value || a.name.localeCompare(b.name)
		)
	}
}

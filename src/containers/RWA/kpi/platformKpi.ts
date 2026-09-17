import type { RWAOverviewDisplayRow } from '../api.types'
import { rankRwaDefiProtocols, type RwaNamedBar } from '../cards/cardData'
import { aggregateRwaGroupMetrics, collectRwaGroupDistinct, tallyRwaGroupFlags } from '../table/grouping'
import {
	buildRwaLeafRows,
	type RWAGroupDistinct,
	type RWAGroupFlags,
	type RWALeafRowOptions,
	type RWATableMetrics
} from '../table/rows'

export type RWAPlatformKpi = {
	/** The same fold a group row uses, over the page's rows after its filters. */
	metrics: RWATableMetrics
	flags: RWAGroupFlags
	distinct: RWAGroupDistinct
	largestProtocol: RwaNamedBar | null
	permissionlessCount: number
	/** Active mcap per issuer, largest first; unpriced rows count as zero so every issuer is listed. */
	issuersByMcap: Array<RwaNamedBar>
}

/**
 * Every number the platform header shows, from the rows the table shows with the same options (bridges, the flow
 * summary); the index's own AUM is not read.
 */
export function foldRwaPlatformKpi(
	displayRows: Array<RWAOverviewDisplayRow>,
	options: RWALeafRowOptions
): RWAPlatformKpi {
	/* The Perps view adds the platform's perps markets to the page rows; the header counts assets only. */
	const assets = displayRows.filter((row) => row.kind === 'spot')
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

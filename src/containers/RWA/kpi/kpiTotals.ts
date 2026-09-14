import type { RWAOverviewDisplayRow } from '../api.types'
import { aggregateRwaGroupMetrics } from '../table/grouping'
import { buildRwaLeafRows, type RWATableMetrics } from '../table/rows'

/** The same fold a group row uses, over every aggregate row. */
export function sumRwaKpiTotals(assets: Array<RWAOverviewDisplayRow>, includeBridgeTvl: boolean): RWATableMetrics {
	return aggregateRwaGroupMetrics(buildRwaLeafRows(assets, { includeBridgeTvl }))
}

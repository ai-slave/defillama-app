import type { IRWAFlowAggregatePoint, IRWAFlowOverviewSplitPoint, RWAFlowOverviewSplitBy } from './api.types'

/**
 * The split the front page reads when it only needs one total.
 * Every split sums to the same total; the asset group one is the one the breakdown chart already reads.
 */
export const RWA_FLOW_TOTAL_SPLIT_BY: RWAFlowOverviewSplitBy = 'assetGroup'

/**
 * Sums a `flows/overview?splitBy=` response into the aggregate series the flows chart draws.
 * A row where no group carries a value stays null with zero coverage, the rule `aggregateRWAFlowRows` follows.
 */
export function sumRwaFlowSplit(points: Array<IRWAFlowOverviewSplitPoint>): Array<IRWAFlowAggregatePoint> {
	return points.map((point) => {
		const netFlowUsd = sumRwaRowValues(point)
		return { timestamp: point.timestamp, netFlowUsd, coverage: netFlowUsd == null ? 0 : 1 }
	})
}

/** The sum of every series column of a row; null when no column carries a finite value. */
export function sumRwaRowValues(row: { timestamp: number } & Record<string, number | null | undefined>): number | null {
	let total = 0
	let hasValue = false
	for (const key in row) {
		if (key === 'timestamp') continue
		const value = row[key]
		if (value == null || !Number.isFinite(value)) continue
		total += value
		hasValue = true
	}
	return hasValue ? total : null
}

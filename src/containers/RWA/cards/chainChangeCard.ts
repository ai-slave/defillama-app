import type { IRWAAssetsOverview } from '../api.types'
import type { RWAChainHistory } from '../chainFold'
import { aggregateRwaMetricData } from '../chartAggregation'
import type { RWAChartRow } from '../chartDataset'
import { sumRwaKpiTotals } from '../kpi/kpiTotals'
import { percentChange } from '../table/change'
import type { RwaChangeBar, RwaChangeCard } from './cardData'

/** Each chain's per-asset history summed over the page's assets: one column per chain, the rows Change by Chain ranks. */
export function foldRwaChainHistories(
	histories: Array<RWAChainHistory>,
	assets: IRWAAssetsOverview['assets']
): Array<RWAChartRow> {
	const rows = new Map<number, RWAChartRow>()
	for (const { chain, rows: history } of histories) {
		for (const row of aggregateRwaMetricData(assets, history, 'total').source) {
			if (row.Total == null) continue
			const next = rows.get(row.timestamp) ?? { timestamp: row.timestamp }
			next[chain] = row.Total
			rows.set(row.timestamp, next)
		}
	}
	return Array.from(rows.values()).sort((a, b) => a.timestamp - b.timestamp)
}

/** Change by Chain: the page's active AUM and its 30d change from its rows, beside the chain bars. */
export function foldRwaChainChangeCard(assets: IRWAAssetsOverview['assets'], bars: Array<RwaChangeBar>): RwaChangeCard {
	const totals = sumRwaKpiTotals(assets, true)
	const { current, prior } = totals.change['1m'].activeMcap
	return {
		changeUsd: current == null || prior == null ? null : current - prior,
		changePct: percentChange(current, prior),
		bars
	}
}

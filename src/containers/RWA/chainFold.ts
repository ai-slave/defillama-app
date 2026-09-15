import type { IRWAAssetsOverview, IRWAChartMetricRows, RWAChartMetricKey } from './api.types'
import { aggregateRwaMetricData } from './chartAggregation'
import type { RWAPositionalChartDataset } from './chartDataset'
import { RWA_MAX_CHART_SERIES, RWA_OTHERS_SERIES_LABEL } from './chartFold'

/** One chain's per-asset history, the rows `/chart/chain/:chain/asset-breakdown` returns. */
export type RWAChainHistory = { chain: string; rows: IRWAChartMetricRows }

/**
 * The chains the chart draws: the largest by the assets' current per-chain value for the metric.
 * DeFi TVL reads the per-chain split; the two AUM series carry their own chain breakdown.
 */
export function rankRwaChains(
	assets: IRWAAssetsOverview['assets'],
	metric: RWAChartMetricKey,
	max = RWA_MAX_CHART_SERIES
): Array<string> {
	const totals = new Map<string, number>()
	for (const asset of assets) {
		if (asset.kind !== 'spot') continue
		const entries = metric === 'defiActiveTvl' ? asset.defiActiveTvlByChain?.breakdown : asset[metric]?.breakdown
		for (const [chain, value] of entries ?? []) {
			if (value > 0) totals.set(chain, (totals.get(chain) ?? 0) + value)
		}
	}
	return Array.from(totals.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, max)
		.map(([chain]) => chain)
}

/**
 * One series per chain, summed over the page's assets so the chain lines follow the table's filters, on the
 * time axis of the page total. Others is the total minus the drawn chains, floored at zero; it is left out
 * when it is zero everywhere. The payload carries no chain axis, which is why this fold exists.
 */
export function foldRwaChainSeries({
	chains,
	assets,
	total
}: {
	chains: Array<RWAChainHistory>
	assets: IRWAAssetsOverview['assets']
	total: RWAPositionalChartDataset
}): RWAPositionalChartDataset {
	if (total.source.length === 0 || total.dimensions.length < 2 || chains.length === 0) return total
	const chainValues = chains.map(({ rows }) => {
		const folded = aggregateRwaMetricData(assets, rows, 'total')
		const byTimestamp = new Map<number, number | null>()
		for (const row of folded.source) byTimestamp.set(row.timestamp, row.Total ?? null)
		return byTimestamp
	})
	let hasOthers = false
	const source = total.source.map((row) => {
		const timestamp = row[0]
		const totalValue = row[1] ?? null
		let drawn = 0
		const next: RWAPositionalChartDataset['source'][number] = [timestamp, totalValue]
		for (const values of chainValues) {
			const value = values.get(timestamp) ?? null
			if (value != null) drawn += value
			next.push(value)
		}
		const others = totalValue == null ? null : Math.max(0, totalValue - drawn)
		if (others != null && others > 0) hasOthers = true
		next.push(others)
		return next
	})
	const dimensions: RWAPositionalChartDataset['dimensions'] = [
		'timestamp',
		total.dimensions[1],
		...chains.map(({ chain }) => chain),
		RWA_OTHERS_SERIES_LABEL
	]
	if (hasOthers) return { dimensions, source }
	return {
		dimensions: dimensions.slice(0, -1) as typeof dimensions,
		source: source.map((row) => row.slice(0, -1) as typeof row)
	}
}

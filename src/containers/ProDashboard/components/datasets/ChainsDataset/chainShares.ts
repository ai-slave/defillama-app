import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'

export type ChainShareMetricKey = 'tvl' | 'stablesMcap' | 'totalVolume24h' | 'totalFees24h' | 'totalAppRevenue24h'

export const CHAIN_SHARE_METRICS: ReadonlyArray<{ key: ChainShareMetricKey; name: string }> = [
	{ key: 'tvl', name: 'DeFi TVL % Share' },
	{ key: 'stablesMcap', name: 'Stables % Share' },
	{ key: 'totalVolume24h', name: '24h Volume % Share' },
	{ key: 'totalFees24h', name: '24h Fees % Share' },
	{ key: 'totalAppRevenue24h', name: '24h Revenue % Share' }
]

export function buildChainShareTotals(rows: Array<ChainsDatasetRow> | undefined): Record<ChainShareMetricKey, number> {
	const totals: Record<ChainShareMetricKey, number> = {
		tvl: 0,
		stablesMcap: 0,
		totalVolume24h: 0,
		totalFees24h: 0,
		totalAppRevenue24h: 0
	}
	if (!rows) return totals

	for (const row of rows) {
		for (const { key } of CHAIN_SHARE_METRICS) {
			const value = row[key]
			if (value !== null) totals[key] += value
		}
	}
	return totals
}

export function getChainMetricShare(value: number | null, total: number): number | null {
	return value !== null && total > 0 ? (value / total) * 100 : null
}

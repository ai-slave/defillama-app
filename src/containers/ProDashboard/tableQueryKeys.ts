import type { CexAnalyticsMetric } from '~/containers/Cexs/api.types'

function sortedListKey(values: string[]) {
	if (values.length < 2) return values[0] ?? ''
	return values.toSorted().join(',')
}

export function normalizeProTokenSymbols(tokenSymbols: string[]) {
	const normalized: string[] = []
	const seen = new Set<string>()
	for (const token of tokenSymbols) {
		const symbol = token.trim().toUpperCase()
		if (!symbol || seen.has(symbol)) continue
		seen.add(symbol)
		normalized.push(symbol)
	}
	return normalized
}

export const ORACLE_MEMBERSHIP_QUERY_KEY = ['pro-dashboard', 'oracle-membership'] as const
export const PRO_CEX_SNAPSHOT_QUERY_KEY = ['pro-dashboard', 'cex-analytics', 'snapshot'] as const
export const PRO_CEX_TOTALS_QUERY_KEY = ['pro-dashboard', 'cex-analytics', 'totals'] as const
export const PRO_RWA_ASSETS_TABLE_QUERY_KEY = ['pro-dashboard', 'rwa-assets-table'] as const
export const PRO_RWA_CHAINS_TABLE_QUERY_KEY = ['pro-dashboard', 'rwa-chains-table'] as const
export const PRO_EQUITIES_COMPANIES_QUERY_KEY = ['pro-dashboard', 'equities-companies-table'] as const
export const getProEquitiesStatementsCacheKey = (ticker: string) =>
	['pro-dashboard', 'equities-statements-table', ticker] as const
export const getProEquitiesFilingsCacheKey = (ticker: string) =>
	['pro-dashboard', 'equities-filings-table', ticker] as const

export function getProTokenUsageQueryKey(tokenSymbols: string[], includeCex: boolean) {
	return ['pro-dashboard', 'token-usage', normalizeProTokenSymbols(tokenSymbols).toSorted(), includeCex] as const
}

export const getProCexShareQueryKey = (metric: CexAnalyticsMetric, topN: number) =>
	['pro-dashboard', 'cex-analytics', 'share', metric, topN] as const

export const getProChainsDatasetQueryKey = (category?: string) =>
	['pro-dashboard', 'chains-overview', category || 'all'] as const

export const getProYieldsDatasetQueryKey = (chains: string[]) =>
	['pro-dashboard', 'yields-v2', chains.includes('All') ? '' : sortedListKey(chains)] as const

export const getProStablecoinsTableQueryKey = (chain: string) =>
	['pro-dashboard', 'stablecoins-overview', chain] as const

import type { CexAnalyticsMetric } from '~/containers/Cexs/api.types'
import type { ProtocolsTableConfig } from './types'

const PRO_DIMENSION_DATASET = {
	dexs: { queryPrefix: 'dexs-overview', route: 'dexs' },
	perps: { queryPrefix: 'perps-overview', route: 'perps' },
	aggregators: { queryPrefix: 'aggregators-overview', route: 'dex-aggregators' },
	fees: { queryPrefix: 'fees-overview', route: 'fees' },
	revenue: { queryPrefix: 'revenue-overview', route: 'revenue' },
	earnings: { queryPrefix: 'earnings-overview', route: 'earnings' },
	'holders-revenue': { queryPrefix: 'holders-revenue-overview', route: 'holders-revenue' },
	options: { queryPrefix: 'options-overview', route: 'options' },
	'bridge-aggregators': { queryPrefix: 'bridge-aggregators-overview', route: 'bridge-aggregators' }
} as const satisfies Partial<
	Record<NonNullable<ProtocolsTableConfig['datasetType']>, { queryPrefix: string; route: string }>
>

export type ProDimensionDatasetType = keyof typeof PRO_DIMENSION_DATASET

const LEGACY_TABLE_CHAIN_QUERY_PREFIX = {
	volume: 'protocols-volume-by-chain',
	fees: 'protocols-fees-revenue-by-chain',
	perps: 'protocols-perps-volume-by-chain',
	'open-interest': 'protocols-open-interest-by-chain'
} as const

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

export const PROTOCOLS_LIST_QUERY_KEY = ['protocols-lite'] as const
export const PRO_CEX_SNAPSHOT_QUERY_KEY = ['pro-dashboard', 'cex-analytics', 'snapshot'] as const
export const PRO_CEX_TOTALS_QUERY_KEY = ['pro-dashboard', 'cex-analytics', 'totals'] as const
export const PRO_RWA_ASSETS_TABLE_QUERY_KEY = ['pro-dashboard', 'rwa-assets-table'] as const
export const PRO_RWA_CHAINS_TABLE_QUERY_KEY = ['pro-dashboard', 'rwa-chains-table'] as const
export const PRO_EQUITIES_COMPANIES_QUERY_KEY = ['pro-dashboard', 'equities-companies-table'] as const
export const getProEquitiesStatementsCacheKey = (ticker: string) =>
	['pro-dashboard', 'equities-statements-table', ticker] as const
export const getProEquitiesFilingsCacheKey = (ticker: string) =>
	['pro-dashboard', 'equities-filings-table', ticker] as const

export function isProDimensionDatasetType(datasetType: unknown): datasetType is ProDimensionDatasetType {
	return typeof datasetType === 'string' && Object.hasOwn(PRO_DIMENSION_DATASET, datasetType)
}

export function getProDimensionDatasetQueryKey(datasetType: ProDimensionDatasetType, chains: string[]) {
	// The shared backend treats any filter containing `All` as the unfiltered request.
	const keyChains = chains.includes('All') ? [] : chains
	return ['pro-dashboard', PRO_DIMENSION_DATASET[datasetType].queryPrefix, sortedListKey(keyChains)] as const
}

export const getProDimensionDatasetRoute = (datasetType: ProDimensionDatasetType) =>
	PRO_DIMENSION_DATASET[datasetType].route

export function getProLegacyTableChainQueryKey(metric: 'volume' | 'fees' | 'perps' | 'open-interest', chain: string) {
	return ['pro-dashboard', LEGACY_TABLE_CHAIN_QUERY_PREFIX[metric], chain] as const
}

export function getProLegacyTableDatasetQueryKey(prefix: string, chains: string[]) {
	const sortedChains =
		chains.includes('All') || chains.length === 0 ? ['All'] : chains.length === 1 ? chains : chains.toSorted()
	return ['pro-dashboard', prefix, ...sortedChains] as const
}

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

export const getProRwaChainAssetsTableQueryKey = (chain: string) =>
	['pro-dashboard', 'rwa-chain-assets-table', chain] as const

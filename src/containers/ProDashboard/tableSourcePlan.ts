import { sanitizeRowHeaders } from './components/UnifiedTable/utils/rowHeaders'
import { getProEquitiesFilingsQueryKey, getProEquitiesStatementsQueryKey } from './equitiesTableQueryKeys'
import { buildTableServerDataSourcePlan } from './server/tableQueries'
import {
	getProCexShareQueryKey,
	getProChainsDatasetQueryKey,
	getProDimensionDatasetQueryKey,
	getProLegacyTableChainQueryKey,
	getProRwaChainAssetsTableQueryKey,
	getProStablecoinsTableQueryKey,
	getProYieldsDatasetQueryKey,
	isProDimensionDatasetType,
	PRO_CEX_SNAPSHOT_QUERY_KEY,
	PRO_CEX_TOTALS_QUERY_KEY,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY,
	PROTOCOLS_LIST_QUERY_KEY
} from './tableQueryKeys'
import type { DashboardItemConfig } from './types'
import { getUnifiedTableQueryIdentity } from './unifiedTableQuery'

export type ProDashboardTableChunkType =
	| 'tableData'
	| 'unifiedTableData'
	| 'dimensionDatasetData'
	| 'cexAnalyticsData'
	| 'chainsDatasetData'
	| 'yieldsDatasetData'
	| 'stablecoinsTableData'
	| 'rwaAssetsTableData'
	| 'rwaChainsTableData'
	| 'rwaChainAssetsTableData'
	| 'equitiesCompaniesData'
	| 'equitiesStatementsData'
	| 'equitiesFilingsData'

export interface ProDashboardTableSource {
	chunkType: ProDashboardTableChunkType
	key: string
}

export interface ProDashboardTableSourcePlan {
	streamSources: ProDashboardTableSource[]
	clientOnlySources: string[]
}

function serializedKey(queryKey: readonly unknown[]) {
	return JSON.stringify(queryKey)
}

export function buildProDashboardTableSourcePlan(items: DashboardItemConfig[]): ProDashboardTableSourcePlan {
	const streamSources = new Map<string, ProDashboardTableSource>()
	const clientOnlySources = new Set<string>()
	const addKey = (chunkType: ProDashboardTableChunkType, key: string) => {
		streamSources.set(`${chunkType}:${key}`, { chunkType, key })
	}
	const add = (chunkType: ProDashboardTableChunkType, queryKey: readonly unknown[]) =>
		addKey(chunkType, serializedKey(queryKey))

	const bulkPlan = buildTableServerDataSourcePlan(items)
	if (bulkPlan.hasProtocolsTable) {
		add('tableData', PROTOCOLS_LIST_QUERY_KEY)
		for (const { source, chain } of bulkPlan.chainSources) {
			const metric = source === 'openInterest' ? 'open-interest' : source
			add('tableData', getProLegacyTableChainQueryKey(metric, chain))
		}
		for (const source of bulkPlan.datasetSources) {
			addKey('tableData', source.cacheKey)
		}
	}
	for (const source of bulkPlan.tokenUsageConfigs) {
		addKey('tableData', source.cacheKey)
	}

	for (const item of items) {
		if (item.kind === 'unified-table') {
			const headers = sanitizeRowHeaders(item.rowHeaders)
			add('unifiedTableData', getUnifiedTableQueryIdentity(item, headers).queryKey)
			continue
		}
		if (item.kind !== 'table' || item.tableType !== 'dataset') continue
		if (isProDimensionDatasetType(item.datasetType)) {
			add('dimensionDatasetData', getProDimensionDatasetQueryKey(item.datasetType, item.chains))
			continue
		}

		switch (item.datasetType) {
			case 'cex':
				add('cexAnalyticsData', PRO_CEX_SNAPSHOT_QUERY_KEY)
				break
			case 'cex-analytics': {
				const rawView = item.cexAnalyticsView as typeof item.cexAnalyticsView | 'efficiency'
				const view = rawView === 'efficiency' ? 'comparison' : rawView || 'comparison'
				if (view === 'summary' || view === 'comparison') {
					add('cexAnalyticsData', PRO_CEX_SNAPSHOT_QUERY_KEY)
				} else if (view === 'spot-vs-derivatives') {
					add('cexAnalyticsData', PRO_CEX_TOTALS_QUERY_KEY)
				} else if (view === 'market-share') {
					add(
						'cexAnalyticsData',
						getProCexShareQueryKey(
							item.cexAnalyticsMetric === 'spot' ? 'spot' : 'derivatives',
							item.cexAnalyticsTopN ?? 8
						)
					)
				}
				break
			}
			case 'chains':
				add('chainsDatasetData', getProChainsDatasetQueryKey(item.datasetChain))
				break
			case 'yields':
				add('yieldsDatasetData', getProYieldsDatasetQueryKey(item.chains))
				break
			case 'stablecoins':
				add('stablecoinsTableData', getProStablecoinsTableQueryKey(item.datasetChain || 'All'))
				break
			case 'rwa':
				add('rwaAssetsTableData', PRO_RWA_ASSETS_TABLE_QUERY_KEY)
				break
			case 'rwa-chains':
				add('rwaChainsTableData', PRO_RWA_CHAINS_TABLE_QUERY_KEY)
				break
			case 'rwa-selected-chain':
				add('rwaAssetsTableData', PRO_RWA_ASSETS_TABLE_QUERY_KEY)
				add('rwaChainAssetsTableData', getProRwaChainAssetsTableQueryKey(item.datasetChain || 'Ethereum'))
				break
			case 'equities':
				add('equitiesCompaniesData', PRO_EQUITIES_COMPANIES_QUERY_KEY)
				break
			case 'equities-financials': {
				const queryKey = getProEquitiesStatementsQueryKey(item.datasetChain || '')
				if (queryKey) add('equitiesStatementsData', queryKey)
				break
			}
			case 'equities-filings': {
				const queryKey = getProEquitiesFilingsQueryKey(item.datasetChain || '')
				if (queryKey) add('equitiesFilingsData', queryKey)
				break
			}
			case 'trending-contracts':
				clientOnlySources.add(
					serializedKey([
						'pro-dashboard',
						'trending-contracts',
						item.datasetTimeframe || '1d',
						(item.datasetChain || 'ethereum').toLowerCase()
					])
				)
				break
			default:
				// Persisted stablecoin tables predate datasetType.
				if (item.datasetType == null) {
					add('stablecoinsTableData', getProStablecoinsTableQueryKey(item.datasetChain || 'All'))
				}
		}
	}

	return { streamSources: Array.from(streamSources.values()), clientOnlySources: Array.from(clientOnlySources) }
}

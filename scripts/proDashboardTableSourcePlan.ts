import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { DashboardStreamChunk } from '~/containers/ProDashboard/dashboardStreamContract'
import { getEquitiesTableQueryKey } from '~/containers/ProDashboard/equitiesTableQueryKeys'
import {
	getProCexShareQueryKey,
	getProChainsDatasetQueryKey,
	getProStablecoinsTableQueryKey,
	getProYieldsDatasetQueryKey,
	PRO_CEX_SNAPSHOT_QUERY_KEY,
	PRO_CEX_TOTALS_QUERY_KEY,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY
} from '~/containers/ProDashboard/tableQueryKeys'
import { buildTokenUsageSourcePlan } from '~/containers/ProDashboard/tokenUsageSourcePlan'
import { sanitizeUnifiedTableRowHeaders } from '~/containers/ProDashboard/unifiedTable/config/layoutPolicy'
import { getUnifiedTableQueryIdentity } from '~/containers/ProDashboard/unifiedTableQuery'

export type ProDashboardTableChunkType = Extract<
	DashboardStreamChunk['type'],
	| 'tokenUsageData'
	| 'unifiedTableData'
	| 'cexAnalyticsData'
	| 'chainsDatasetData'
	| 'yieldsDatasetData'
	| 'stablecoinsTableData'
	| 'rwaAssetsTableData'
	| 'rwaChainsTableData'
	| 'equitiesCompaniesData'
	| 'equitiesStatementsData'
	| 'equitiesFilingsData'
>

export interface ProDashboardTableSource {
	chunkType: ProDashboardTableChunkType
	key: string
}

export interface ProDashboardTableSourcePlan {
	streamSources: ProDashboardTableSource[]
}

function serializedKey(queryKey: readonly unknown[]) {
	return JSON.stringify(queryKey)
}

export function buildProDashboardTableSourcePlan(items: DashboardItemConfig[]): ProDashboardTableSourcePlan {
	const streamSources = new Map<string, ProDashboardTableSource>()
	const addKey = (chunkType: ProDashboardTableChunkType, key: string) => {
		streamSources.set(`${chunkType}:${key}`, { chunkType, key })
	}
	const add = (chunkType: ProDashboardTableChunkType, queryKey: readonly unknown[]) =>
		addKey(chunkType, serializedKey(queryKey))

	for (const source of buildTokenUsageSourcePlan(items)) {
		addKey('tokenUsageData', source.cacheKey)
	}

	for (const item of items) {
		if (item.kind === 'unified-table') {
			const headers = sanitizeUnifiedTableRowHeaders(item.rowHeaders)
			add('unifiedTableData', getUnifiedTableQueryIdentity(item, headers).queryKey)
			continue
		}
		if (item.kind !== 'dataset-table') continue
		switch (item.datasetType) {
			case 'token-usage':
				// Token Usage is planned by buildTokenUsageSourcePlan above.
				continue
			case 'cex-analytics': {
				const view = item.cexAnalyticsView
				if (view === 'summary' || view === 'comparison') {
					add('cexAnalyticsData', PRO_CEX_SNAPSHOT_QUERY_KEY)
				} else if (view === 'spot-vs-derivatives') {
					add('cexAnalyticsData', PRO_CEX_TOTALS_QUERY_KEY)
				} else if (view === 'market-share') {
					add('cexAnalyticsData', getProCexShareQueryKey(item.cexAnalyticsMetric, item.cexAnalyticsTopN))
				}
				continue
			}
			case 'chains':
				add('chainsDatasetData', getProChainsDatasetQueryKey(item.category))
				continue
			case 'yields':
				add('yieldsDatasetData', getProYieldsDatasetQueryKey(item.chains))
				continue
			case 'stablecoins':
				add('stablecoinsTableData', getProStablecoinsTableQueryKey(item.chain))
				continue
			case 'rwa':
				add('rwaAssetsTableData', PRO_RWA_ASSETS_TABLE_QUERY_KEY)
				continue
			case 'rwa-chains':
				add('rwaChainsTableData', PRO_RWA_CHAINS_TABLE_QUERY_KEY)
				continue
			case 'rwa-selected-chain':
				add('rwaAssetsTableData', PRO_RWA_ASSETS_TABLE_QUERY_KEY)
				continue
			case 'equities':
				add('equitiesCompaniesData', PRO_EQUITIES_COMPANIES_QUERY_KEY)
				continue
			case 'equities-financials': {
				const queryKey = getEquitiesTableQueryKey('statements', item.ticker)
				if (queryKey) add('equitiesStatementsData', queryKey)
				continue
			}
			case 'equities-filings': {
				const queryKey = getEquitiesTableQueryKey('filings', item.ticker)
				if (queryKey) add('equitiesFilingsData', queryKey)
				continue
			}
		}
		const exhaustiveDataset: never = item
		return exhaustiveDataset
	}

	return { streamSources: Array.from(streamSources.values()) }
}

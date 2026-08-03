import type { DatasetTableConfig, TextConfig } from '../../types'
import { createDatasetTableConfig } from '../datasetTableConfig'
import type { PersistedDatasetTableConfig, UnversionedUnifiedTableConfig } from '../persisted'
import { migrateProtocolMetricDatasetTable } from './protocolMetricDatasetTables'

/**
 * Dataset-table compatibility history:
 *
 * - A missing dataset type meant Stablecoins; `cex` and the removed CEX `efficiency` view now mean comparison.
 * - Trending Contracts was retired because its third-party feed has no canonical Lens or DefiLlama contract.
 * - `datasetChain` becomes the chain, category, or ticker only for datasets that assigned it that meaning.
 * - Protocol metric datasets become canonical Unified Table presets and retain chain/category row scope.
 * - Yields and Chains retain their owned column settings; other datasets discard legacy presentation fields.
 * - Current configs are rebuilt by `createDatasetTableConfig`, which owns chain aliases, filter projection,
 *   Token Usage's four-symbol limit, and the CEX market-share Top N range.
 */

export function migrateDatasetTable(
	config: PersistedDatasetTableConfig
): DatasetTableConfig | TextConfig | UnversionedUnifiedTableConfig {
	if (config.datasetType === 'trending-contracts') {
		return {
			id: config.id,
			kind: 'text',
			title: 'Trending Contracts retired',
			content:
				'This table used a non-canonical third-party feed and has been retired. Replace it with a canonical Pro dataset.',
			...(config.colSpan === undefined ? {} : { colSpan: config.colSpan })
		}
	}

	const common = {
		id: config.id,
		...(config.colSpan === undefined ? {} : { colSpan: config.colSpan })
	}
	const datasetType = config.datasetType ?? 'stablecoins'
	switch (datasetType) {
		case 'revenue':
		case 'holders-revenue':
		case 'earnings':
		case 'fees':
		case 'aggregators':
		case 'perps':
		case 'options':
		case 'dexs':
		case 'bridge-aggregators':
			return migrateProtocolMetricDatasetTable({
				...common,
				datasetType,
				chains: config.chains ?? [],
				...(config.filters ? { filters: config.filters } : {})
			})
		case 'token-usage':
			return createDatasetTableConfig({
				...common,
				datasetType,
				tokenSymbols: config.tokenSymbols ?? [],
				includeCex: config.includeCex ?? false
			})
		case 'cex':
		case 'cex-analytics': {
			const view = config.cexAnalyticsView === 'efficiency' ? 'comparison' : (config.cexAnalyticsView ?? 'comparison')
			return view === 'market-share'
				? createDatasetTableConfig({
						...common,
						datasetType: 'cex-analytics',
						cexAnalyticsView: view,
						cexAnalyticsMetric: config.cexAnalyticsMetric ?? 'derivatives',
						cexAnalyticsTopN: config.cexAnalyticsTopN ?? 8
					})
				: createDatasetTableConfig({
						...common,
						datasetType: 'cex-analytics',
						cexAnalyticsView: view
					})
		}
		case 'stablecoins':
			return createDatasetTableConfig({
				...common,
				datasetType,
				chain: config.datasetChain ?? 'All'
			})
		case 'yields':
			return createDatasetTableConfig({
				...common,
				datasetType,
				chains: config.chains ?? [],
				...(config.filters ? { filters: config.filters } : {}),
				...(config.columnOrder ? { columnOrder: config.columnOrder } : {}),
				...(config.columnVisibility ? { columnVisibility: config.columnVisibility } : {})
			})
		case 'chains':
			return createDatasetTableConfig({
				...common,
				datasetType,
				...(config.datasetChain === undefined ? {} : { category: config.datasetChain }),
				...(config.columnOrder ? { columnOrder: config.columnOrder } : {}),
				...(config.columnVisibility ? { columnVisibility: config.columnVisibility } : {})
			})
		case 'rwa':
		case 'rwa-chains':
		case 'equities':
			return createDatasetTableConfig({ ...common, datasetType })
		case 'rwa-selected-chain':
			return createDatasetTableConfig({
				...common,
				datasetType,
				chain: config.datasetChain ?? 'Ethereum'
			})
		case 'equities-financials':
		case 'equities-filings':
			return createDatasetTableConfig({ ...common, datasetType, ticker: config.datasetChain ?? '' })
	}
}

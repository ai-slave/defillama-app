import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard } from '../dashboardTypes'
import type { ChartConfig } from '../types'
import type { UnifiedTableConfig } from '../unifiedTable/config/current'
import { migrateUnifiedTableV1 } from '../unifiedTable/config/migrations/unifiedTableV1'
import { migrateUnifiedTableV2 } from '../unifiedTable/config/migrations/unifiedTableV2'
import { migrateUnifiedTableV3 } from '../unifiedTable/config/migrations/unifiedTableV3'
import { migrateUnversionedUnifiedTable } from '../unifiedTable/config/migrations/unversionedUnifiedTable'
import { createDatasetTableConfig } from './datasetTableConfig'
import { migrateChartBuilder } from './migrations/chartBuilder'
import { migrateChartSubject } from './migrations/chartSubject'
import { migrateDatasetTable } from './migrations/datasetTables'
import { migrateMetricChartType } from './migrations/metricChartType'
import {
	isPersistedProtocolMetricDatasetTable,
	migrateProtocolMetricDatasetTable
} from './migrations/protocolMetricDatasetTables'
import { migrateProtocolsTable } from './migrations/protocolsTable'
import { migrateProtocolsTableWithoutTableType } from './migrations/protocolsTableWithoutTableType'
import { migrateRwaOverviewBreakdown } from './migrations/rwaOverviewBreakdown'
import type {
	PersistedDashboard,
	PersistedDashboardItemConfig,
	PersistedUnifiedTableV3Config,
	UnifiedTableV1Config,
	UnifiedTableV2Config,
	UnversionedUnifiedTableConfig
} from './persisted'

type AssertNoMissingDashboardItemKind<Missing extends never> = Missing

/** Adding a current card kind must also extend the persisted input union and migration dispatcher. */
type MigratedDashboardItemConfig = [
	AssertNoMissingDashboardItemKind<Exclude<DashboardItemConfig['kind'], PersistedDashboardItemConfig['kind']>>
] extends [never]
	? DashboardItemConfig
	: never

function migrateUnifiedTable(
	config: UnversionedUnifiedTableConfig | UnifiedTableV1Config | UnifiedTableV2Config | PersistedUnifiedTableV3Config
): UnifiedTableConfig {
	const versionedConfig = 'configVersion' in config ? config : migrateUnversionedUnifiedTable(config)
	switch (versionedConfig.configVersion) {
		case 1:
			return migrateUnifiedTableV3(migrateUnifiedTableV2(migrateUnifiedTableV1(versionedConfig)))
		case 2:
			return migrateUnifiedTableV3(migrateUnifiedTableV2(versionedConfig))
		case 3:
			return migrateUnifiedTableV3(versionedConfig)
		default:
			return versionedConfig satisfies never
	}
}

export function migrateDashboardItemConfig(config: PersistedDashboardItemConfig): MigratedDashboardItemConfig | null {
	switch (config.kind) {
		case 'chart':
			return migrateChartSubject(config)
		case 'multi': {
			const items: ChartConfig[] = []
			for (const item of config.items) {
				const migrated = migrateChartSubject(item)
				if (migrated) items.push(migrated)
			}
			return items.length > 0 ? { ...config, items } : null
		}
		case 'metric':
			return migrateMetricChartType(config)
		case 'builder':
			return migrateChartBuilder(config)
		case 'dataset-table':
			if (isPersistedProtocolMetricDatasetTable(config)) {
				return migrateUnifiedTable(migrateProtocolMetricDatasetTable(config))
			}
			return createDatasetTableConfig(config)
		case 'rwa-overview':
			return migrateRwaOverviewBreakdown(config)
		case 'unified-table':
			return migrateUnifiedTable(config)
		case 'table':
			if (!('tableType' in config)) {
				return migrateProtocolsTable(migrateProtocolsTableWithoutTableType(config))
			}
			switch (config.tableType) {
				case 'protocols':
					return migrateProtocolsTable('chains' in config ? config : { ...config, chains: [] })
				case 'dataset': {
					const migrated = migrateDatasetTable(config)
					return migrated.kind === 'unified-table' ? migrateUnifiedTable(migrated) : migrated
				}
				default:
					return config satisfies never
			}
		case 'text':
		case 'yields':
		case 'stablecoins':
		case 'stablecoin-asset':
		case 'advanced-tvl':
		case 'advanced-borrowed':
		case 'income-statement':
		case 'unlocks-schedule':
		case 'unlocks-pie':
		case 'llamaai-chart':
		case 'rwa-asset':
		case 'sql':
			return config
		default:
			return config satisfies never
	}
}

export function migrateDashboardItems(items: readonly PersistedDashboardItemConfig[]): DashboardItemConfig[] {
	const migratedItems: DashboardItemConfig[] = []
	for (const item of items) {
		const migrated = migrateDashboardItemConfig(item)
		if (migrated) migratedItems.push(migrated)
	}
	return migratedItems
}

export function migrateDashboardConfig(dashboard: PersistedDashboard): Dashboard {
	const { items, aiUndoState, ...data } = dashboard.data
	return {
		...dashboard,
		data: {
			...data,
			items: migrateDashboardItems(items),
			...(aiUndoState ? { aiUndoState: { ...aiUndoState, items: migrateDashboardItems(aiUndoState.items) } } : {})
		}
	}
}

import type { DashboardItemConfig } from '../dashboardItemConfig'
import {
	DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH,
	DASHBOARD_VARIABLE_LABEL_MAX_LENGTH,
	type Dashboard,
	type DashboardAnnotation,
	type DashboardVariable,
	MAX_DASHBOARD_ANNOTATIONS,
	MAX_DASHBOARD_VARIABLES
} from '../dashboardTypes'
import { sanitizeDashboardItemBindings } from '../dashboardVariables/bindableFields'
import { DASHBOARD_VARIABLE_VALUE_PATTERN } from '../dashboardVariables/resolve'
import {
	type ChartConfig,
	type CustomDataConfig,
	type CustomDataRows,
	isDashboardCardHeight,
	SECTION_DESCRIPTION_MAX_LENGTH,
	SECTION_TITLE_MAX_LENGTH,
	type SectionConfig,
	type SqlSnapshotValue
} from '../types'
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

const POCKETBASE_OFFSET_INSTANT = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))$/i

function normalizeDashboardTimestamp(value: string): string {
	return value.replace(POCKETBASE_OFFSET_INSTANT, '$1T$2')
}

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

const DASHBOARD_VARIABLE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/
const ANNOTATION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_CUSTOM_DATA_COLUMNS = 30
export const MAX_CUSTOM_DATA_ROWS = 5000

function plainText(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isValidAnnotationDate(value: unknown): value is string {
	if (typeof value !== 'string' || !ANNOTATION_DATE_PATTERN.test(value)) return false
	const parsed = new Date(`${value}T00:00:00Z`)
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export function sanitizeDashboardVariables(value: unknown): Array<DashboardVariable> {
	if (!Array.isArray(value)) return []
	const variables: Array<DashboardVariable> = []
	const seen = new Set<string>()
	for (const entry of value) {
		if (variables.length >= MAX_DASHBOARD_VARIABLES) break
		if (!isRecord(entry)) continue
		const { id, kind, value: variableValue } = entry
		if (typeof id !== 'string' || !DASHBOARD_VARIABLE_ID_PATTERN.test(id) || seen.has(id)) continue
		if (kind !== 'chain' && kind !== 'protocol') continue
		if (typeof variableValue !== 'string' || !DASHBOARD_VARIABLE_VALUE_PATTERN.test(variableValue)) continue
		const label =
			plainText(entry.label, DASHBOARD_VARIABLE_LABEL_MAX_LENGTH) || (kind === 'chain' ? 'Chain' : 'Protocol')
		seen.add(id)
		variables.push({ id, kind, label, value: variableValue })
	}
	return variables
}

export function sanitizeDashboardAnnotations(value: unknown): Array<DashboardAnnotation> {
	if (!Array.isArray(value)) return []
	const annotations: Array<DashboardAnnotation> = []
	const seen = new Set<string>()
	for (const entry of value) {
		if (annotations.length >= MAX_DASHBOARD_ANNOTATIONS) break
		if (!isRecord(entry)) continue
		const { id, date } = entry
		if (typeof id !== 'string' || !id || id.length > 64 || seen.has(id)) continue
		if (!isValidAnnotationDate(date)) continue
		const label = plainText(entry.label, DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH)
		if (!label) continue
		seen.add(id)
		annotations.push({ id, date, label })
	}
	return annotations
}

function migrateSection(config: SectionConfig): SectionConfig {
	const description = plainText(config.description, SECTION_DESCRIPTION_MAX_LENGTH)
	return {
		id: config.id,
		kind: 'section',
		title: plainText(config.title, SECTION_TITLE_MAX_LENGTH) || 'Section',
		...(description ? { description } : {}),
		displayAs: config.displayAs === 'tab' ? 'tab' : 'heading',
		...(config.collapsed === true ? { collapsed: true } : {})
	}
}

function sanitizeCustomDataRows(rows: unknown, columnCount: number): CustomDataRows | undefined {
	if (Array.isArray(rows)) {
		const sanitized: Array<Array<SqlSnapshotValue>> = []
		for (const row of rows) {
			if (sanitized.length >= MAX_CUSTOM_DATA_ROWS) break
			if (Array.isArray(row) && row.length === columnCount) sanitized.push(row)
		}
		return sanitized
	}
	if (
		isRecord(rows) &&
		rows.encoding === 'gzip-base64' &&
		typeof rows.data === 'string' &&
		typeof rows.rowCount === 'number' &&
		Number.isInteger(rows.rowCount) &&
		rows.rowCount >= 0
	) {
		return { encoding: 'gzip-base64', data: rows.data, rowCount: rows.rowCount }
	}
	return undefined
}

function migrateCustomData(config: CustomDataConfig): CustomDataConfig | null {
	if (!Array.isArray(config.columns) || !isRecord(config.chart)) return null
	const columns: CustomDataConfig['columns'] = []
	for (const column of config.columns) {
		if (columns.length >= MAX_CUSTOM_DATA_COLUMNS) break
		if (isRecord(column) && typeof column.name === 'string' && typeof column.type === 'string') {
			columns.push({ name: column.name, type: column.type })
		}
	}
	if (columns.length === 0) return null
	const rows = config.rows === undefined ? undefined : sanitizeCustomDataRows(config.rows, columns.length)
	const sourceName = plainText(config.sourceName, 120)
	return {
		id: config.id,
		kind: 'custom-data',
		name: plainText(config.name, 120) || 'Custom data',
		...(sourceName ? { sourceName } : {}),
		columns,
		...(rows === undefined ? {} : { rows }),
		chart: config.chart,
		displayMode: config.displayMode === 'table' ? 'table' : 'chart',
		...(config.colSpan === undefined ? {} : { colSpan: config.colSpan }),
		...(isDashboardCardHeight(config.height) ? { height: config.height } : {})
	}
}

function sanitizeDashboardItemExtras<Item extends DashboardItemConfig>(item: Item): Item {
	let next: Item = item
	if ('height' in next && next.height !== undefined && !isDashboardCardHeight(next.height)) {
		const { height: _height, ...rest } = next
		next = rest as Item
	}
	if ('bindings' in next && next.bindings !== undefined) {
		const bindings = sanitizeDashboardItemBindings(next, next.bindings)
		const { bindings: _bindings, ...rest } = next
		next = (bindings ? { ...rest, bindings } : rest) as Item
	}
	return next
}

export function migrateDashboardItemConfig(config: PersistedDashboardItemConfig): MigratedDashboardItemConfig | null {
	const migrated = migrateDashboardItemKind(config)
	return migrated ? sanitizeDashboardItemExtras(migrated) : null
}

function migrateDashboardItemKind(config: PersistedDashboardItemConfig): MigratedDashboardItemConfig | null {
	switch (config.kind) {
		case 'chart':
			return migrateChartSubject(config)
		case 'multi': {
			const items: Array<ChartConfig> = []
			for (const item of config.items) {
				const migrated = migrateChartSubject(item)
				if (migrated) items.push(sanitizeDashboardItemExtras(migrated))
			}
			return items.length > 0 ? { ...config, items } : null
		}
		case 'section':
			return migrateSection(config)
		case 'custom-data':
			return migrateCustomData(config)
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

export function migrateDashboardItems(items: ReadonlyArray<PersistedDashboardItemConfig>): Array<DashboardItemConfig> {
	const migratedItems: Array<DashboardItemConfig> = []
	for (const item of items) {
		const migrated = migrateDashboardItemConfig(item)
		if (migrated) migratedItems.push(migrated)
	}
	return migratedItems
}

export function migrateDashboardConfig(dashboard: PersistedDashboard): Dashboard {
	const { items, aiUndoState, variables, annotations, ...data } = dashboard.data
	return {
		...dashboard,
		created: normalizeDashboardTimestamp(dashboard.created),
		updated: normalizeDashboardTimestamp(dashboard.updated),
		...(dashboard.editedAt === undefined ? {} : { editedAt: normalizeDashboardTimestamp(dashboard.editedAt) }),
		data: {
			...data,
			items: migrateDashboardItems(items),
			...(variables === undefined ? {} : { variables: sanitizeDashboardVariables(variables) }),
			...(annotations === undefined ? {} : { annotations: sanitizeDashboardAnnotations(annotations) }),
			...(aiUndoState ? { aiUndoState: { ...aiUndoState, items: migrateDashboardItems(aiUndoState.items) } } : {})
		}
	}
}

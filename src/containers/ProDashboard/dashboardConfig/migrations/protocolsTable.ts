import {
	UNIFIED_TABLE_CONFIG_VERSION,
	type UnifiedTableConfig,
	type UnifiedTableFilters
} from '../../unifiedTable/config/current'
import type { CustomColumnDefinition } from '../../unifiedTable/config/types'
import { getLegacyProtocolTableColumnPolicy } from '../legacyProtocolTableColumnPolicy'
import { getLegacyProtocolTablePresetMigration } from '../legacyProtocolTablePresets'
import type { PersistedProtocolsTableConfig, PersistedProtocolTableFilters } from '../persisted'

const DEFAULT_LEGACY_PRESET_ID = 'essential'

function createHistoricalProtocolTableColumnVisibility(
	columnOrder: ReadonlyArray<string>,
	customColumns: ReadonlyArray<CustomColumnDefinition>
): Record<string, boolean> {
	const visibility: Record<string, boolean> = { name: true }
	for (const column of customColumns) visibility[column.id] = false
	for (const id of columnOrder) visibility[id] = true
	return visibility
}

function migrateColumnId(id: string): string | null {
	if (id.startsWith('custom_')) return id
	const policy = getLegacyProtocolTableColumnPolicy(id)
	if (!policy || policy.disposition === 'remove') return null
	return policy.disposition === 'rename' ? policy.target : id
}

function expressionVariables(expression: string): Array<string> {
	return expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
}

function migrateExpression(expression: string): string {
	return expression.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) => migrateColumnId(id) ?? id)
}

function migrateCustomColumns(
	columns: NonNullable<PersistedProtocolsTableConfig['customColumns']>
): Array<CustomColumnDefinition> {
	const removed = new Set<string>()
	for (const column of columns) {
		if (!column.isValid) removed.add(column.id)
	}

	let changed = true
	while (changed) {
		changed = false
		for (const column of columns) {
			if (removed.has(column.id)) continue
			const dependsOnRemoved = expressionVariables(column.expression).some((id) => {
				const policy = getLegacyProtocolTableColumnPolicy(id)
				return policy?.disposition === 'remove' || removed.has(id)
			})
			if (!dependsOnRemoved) continue
			removed.add(column.id)
			changed = true
		}
	}

	const result: Array<CustomColumnDefinition> = []
	for (const column of columns) {
		if (removed.has(column.id)) continue
		result.push({
			id: column.id,
			name: column.name,
			expression: migrateExpression(column.expression),
			format: 'usd',
			aggregation: 'recalculate'
		})
	}
	return result
}

function migrateFilters(filters: PersistedProtocolTableFilters): {
	filters: UnifiedTableFilters
	sorting: Array<{ id: string; desc: boolean }>
} {
	const {
		sortBy,
		sortOrder,
		tokenSymbols: _tokenSymbols,
		tokens: _tokens,
		apyMin: _apyMin,
		apyMax: _apyMax,
		baseApyMin: _baseApyMin,
		baseApyMax: _baseApyMax,
		hasRewards: _hasRewards,
		stablesOnly: _stablesOnly,
		activeLending: _activeLending,
		poolTypes: _poolTypes,
		volumeChange7dMin,
		volumeChange7dMax,
		volumeChange1mMin,
		volumeChange1mMax,
		feesChange7dMin,
		feesChange7dMax,
		feesChange1mMin,
		feesChange1mMax,
		revenueChange7dMin,
		revenueChange7dMax,
		revenueChange1mMin,
		revenueChange1mMax,
		treasuryRevenue24hMin: _treasuryRevenue24hMin,
		treasuryRevenue24hMax: _treasuryRevenue24hMax,
		hasTreasuryRevenue: _hasTreasuryRevenue,
		...retained
	} = filters

	const migratedFilters: UnifiedTableFilters = {
		...retained,
		...(volumeChange7dMin === undefined ? {} : { volume24hChange7dAgoMin: volumeChange7dMin }),
		...(volumeChange7dMax === undefined ? {} : { volume24hChange7dAgoMax: volumeChange7dMax }),
		...(volumeChange1mMin === undefined ? {} : { volume24hChange30dAgoMin: volumeChange1mMin }),
		...(volumeChange1mMax === undefined ? {} : { volume24hChange30dAgoMax: volumeChange1mMax }),
		...(feesChange7dMin === undefined ? {} : { fees24hChange7dAgoMin: feesChange7dMin }),
		...(feesChange7dMax === undefined ? {} : { fees24hChange7dAgoMax: feesChange7dMax }),
		...(feesChange1mMin === undefined ? {} : { fees24hChange30dAgoMin: feesChange1mMin }),
		...(feesChange1mMax === undefined ? {} : { fees24hChange30dAgoMax: feesChange1mMax }),
		...(revenueChange7dMin === undefined ? {} : { revenue24hChange7dAgoMin: revenueChange7dMin }),
		...(revenueChange7dMax === undefined ? {} : { revenue24hChange7dAgoMax: revenueChange7dMax }),
		...(revenueChange1mMin === undefined ? {} : { revenue24hChange30dAgoMin: revenueChange1mMin }),
		...(revenueChange1mMax === undefined ? {} : { revenue24hChange30dAgoMax: revenueChange1mMax })
	}
	const migratedSortId = sortBy ? migrateColumnId(sortBy) : null
	return {
		filters: migratedFilters,
		sorting: migratedSortId ? [{ id: migratedSortId, desc: sortOrder !== 'asc' }] : []
	}
}

export function migrateProtocolsTable(config: PersistedProtocolsTableConfig): UnifiedTableConfig {
	const customColumns = migrateCustomColumns(config.customColumns ?? [])
	const customColumnIds = new Set(customColumns.map((column) => column.id))
	const keepColumn = (id: string): string | null => {
		if (id.startsWith('custom_')) return customColumnIds.has(id) ? id : null
		return migrateColumnId(id)
	}
	const migrateColumnOrder = (ids: ReadonlyArray<string>): Array<string> => {
		const migratedIds: Array<string> = []
		for (const id of ids) {
			const migrated = keepColumn(id)
			if (migrated && !migratedIds.includes(migrated)) migratedIds.push(migrated)
		}
		return migratedIds
	}
	const savedColumnOrder = migrateColumnOrder(config.columnOrder ?? [])
	if (config.columnOrder?.length && !savedColumnOrder.includes('name')) savedColumnOrder.unshift('name')
	const savedColumnVisibility: Record<string, boolean> = {}
	const explicitVisibilityIds = new Set<string>()
	for (const column of customColumns) savedColumnVisibility[column.id] = false
	for (const id in config.columnVisibility ?? {}) {
		const migrated = keepColumn(id)
		if (!migrated) continue
		savedColumnVisibility[migrated] = config.columnVisibility?.[id] ?? false
		explicitVisibilityIds.add(migrated)
	}
	if (config.columnVisibility && Object.keys(config.columnVisibility).length > 0) {
		for (const id of savedColumnOrder) {
			if (!explicitVisibilityIds.has(id)) savedColumnVisibility[id] = true
		}
		savedColumnVisibility.name = true
	}
	const migratedFilters = config.filters ? migrateFilters(config.filters) : { filters: {}, sorting: [] }
	const savedSorting = migratedFilters.sorting.filter(({ id }) => !id.startsWith('custom_') || customColumnIds.has(id))
	const chains = config.chains.filter((chain) => chain.trim() && chain.toLowerCase() !== 'all')
	const hasSavedColumnOrder = Boolean(config.columnOrder?.length)
	const hasSavedColumnVisibility = Boolean(config.columnVisibility && Object.keys(config.columnVisibility).length > 0)
	const hasExplicitLayout = hasSavedColumnOrder || hasSavedColumnVisibility
	const requestedPreset = config.activePresetId
		? getLegacyProtocolTablePresetMigration(config.activePresetId)
		: undefined
	const preset =
		requestedPreset ??
		(!hasExplicitLayout ? getLegacyProtocolTablePresetMigration(DEFAULT_LEGACY_PRESET_ID) : undefined)
	const usesPresetLayout = !hasExplicitLayout && preset !== undefined
	const presetColumnOrder = preset ? migrateColumnOrder(preset.columnOrder) : []
	const resolvedColumnOrder = hasSavedColumnOrder ? savedColumnOrder : usesPresetLayout ? presetColumnOrder : []
	const resolvedColumnVisibility = hasSavedColumnVisibility
		? savedColumnVisibility
		: hasSavedColumnOrder || usesPresetLayout
			? createHistoricalProtocolTableColumnVisibility(resolvedColumnOrder, customColumns)
			: {}
	const presetSorting: Array<{ id: string; desc: boolean }> = []
	if (usesPresetLayout && preset) {
		for (const { id, desc } of preset.defaultSorting) {
			const migrated = keepColumn(id)
			if (migrated) presetSorting.push({ id: migrated, desc })
		}
	}
	const defaultSorting =
		savedSorting.length > 0 ? savedSorting : presetSorting.length > 0 ? presetSorting : [{ id: 'tvl', desc: true }]

	return {
		id: config.id,
		kind: 'unified-table',
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		strategy: 'protocols',
		rowHeaders: ['parent-protocol', 'protocol'],
		...(chains.length > 0 ? { params: { chains } } : {}),
		...(Object.keys(migratedFilters.filters).length > 0 ? { filters: migratedFilters.filters } : {}),
		...(resolvedColumnOrder.length > 0 ? { columnOrder: [...resolvedColumnOrder] } : {}),
		...(Object.keys(resolvedColumnVisibility).length > 0 ? { columnVisibility: { ...resolvedColumnVisibility } } : {}),
		...(defaultSorting.length > 0 ? { defaultSorting } : {}),
		...(preset ? { activePresetId: preset.targetPresetId } : {}),
		...(config.colSpan === undefined ? {} : { colSpan: config.colSpan }),
		...(config.height === undefined ? {} : { height: config.height }),
		...(customColumns.length > 0 ? { customColumns } : {})
	}
}

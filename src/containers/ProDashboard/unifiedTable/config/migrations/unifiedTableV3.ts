import type { PersistedUnifiedTableV3Config } from '../../../dashboardConfig/persisted'
import type { UnifiedTableConfig, UnifiedTableFilters } from '../current'
import { isColumnAvailableForGrouping, sanitizeFiltersForGrouping } from '../groupingCapabilities'
import { sanitizeUnifiedTableRowHeaders } from '../layoutPolicy'

function migrateFilters(filters: NonNullable<PersistedUnifiedTableV3Config['filters']>): UnifiedTableFilters {
	// These fields belonged to the old shared Yields filter bag and never filtered protocol rows.
	const {
		tokens: _tokens,
		apyMin: _apyMin,
		apyMax: _apyMax,
		baseApyMin: _baseApyMin,
		baseApyMax: _baseApyMax,
		hasRewards: _hasRewards,
		stablesOnly: _stablesOnly,
		activeLending: _activeLending,
		poolTypes: _poolTypes,
		...protocolFilters
	} = filters
	return protocolFilters
}

export function migrateUnifiedTableV3(config: PersistedUnifiedTableV3Config): UnifiedTableConfig {
	const { filters, ...rest } = config
	const rowHeaders = sanitizeUnifiedTableRowHeaders(rest.rowHeaders)
	const migrated: UnifiedTableConfig = { ...rest, rowHeaders }

	if (migrated.columnOrder) {
		migrated.columnOrder = migrated.columnOrder.filter((id) => isColumnAvailableForGrouping(id, rowHeaders))
	}
	if (migrated.columnVisibility) {
		const visibility: Record<string, boolean> = {}
		for (const id in migrated.columnVisibility) {
			const isVisible = migrated.columnVisibility[id]
			if (isVisible !== undefined && isColumnAvailableForGrouping(id, rowHeaders)) visibility[id] = isVisible
		}
		migrated.columnVisibility = visibility
	}
	if (migrated.defaultSorting) {
		migrated.defaultSorting = migrated.defaultSorting.filter((sort) =>
			isColumnAvailableForGrouping(sort.id, rowHeaders)
		)
	}
	const migratedFilters = sanitizeFiltersForGrouping(filters ? migrateFilters(filters) : undefined, rowHeaders)
	if (migratedFilters) migrated.filters = migratedFilters
	return migrated
}

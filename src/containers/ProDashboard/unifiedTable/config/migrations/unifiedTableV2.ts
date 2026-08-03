import { isRemovedLegacyProtocolTableColumn } from '../../../dashboardConfig/legacyProtocolTableColumnPolicy'
import type { UnifiedTableV2Config } from '../../../dashboardConfig/persisted'
import { UNIFIED_TABLE_CONFIG_VERSION, type UnifiedTableConfig, type UnifiedTableFilters } from '../current'

function expressionVariables(expression: string): string[] {
	return expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
}

function migrateFilters(filters: NonNullable<UnifiedTableV2Config['filters']>): UnifiedTableFilters {
	// Treasury revenue never had a distinct canonical adapter dataset. V2 configs may contain these
	// legacy filters; V3 drops them together with the corresponding retired columns.
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
		treasuryRevenue24hMin: _treasuryRevenue24hMin,
		treasuryRevenue24hMax: _treasuryRevenue24hMax,
		hasTreasuryRevenue: _hasTreasuryRevenue,
		...currentFilters
	} = filters
	return currentFilters
}

export function migrateUnifiedTableV2(config: UnifiedTableV2Config): UnifiedTableConfig {
	const removedColumnIds = new Set<string>()
	let removedCustomColumn = true
	while (removedCustomColumn) {
		removedCustomColumn = false
		for (const column of config.customColumns ?? []) {
			if (removedColumnIds.has(column.id)) continue
			const dependsOnRemovedColumn = expressionVariables(column.expression).some(
				(id) => isRemovedLegacyProtocolTableColumn(id) || removedColumnIds.has(id)
			)
			if (!dependsOnRemovedColumn) continue
			removedColumnIds.add(column.id)
			removedCustomColumn = true
		}
	}

	const keepColumn = (id: string): boolean => !isRemovedLegacyProtocolTableColumn(id) && !removedColumnIds.has(id)
	const columnVisibility: Record<string, boolean> = {}
	for (const id in config.columnVisibility ?? {}) {
		const visible = config.columnVisibility?.[id]
		if (visible === undefined) continue
		if (keepColumn(id)) columnVisibility[id] = visible
	}

	const {
		configVersion: _configVersion,
		columnOrder,
		columnVisibility: savedColumnVisibility,
		defaultSorting,
		customColumns,
		filters,
		...rest
	} = config

	return {
		...rest,
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		...(columnOrder ? { columnOrder: columnOrder.filter(keepColumn) } : {}),
		...(savedColumnVisibility ? { columnVisibility } : {}),
		...(defaultSorting ? { defaultSorting: defaultSorting.filter(({ id }) => keepColumn(id)) } : {}),
		...(customColumns ? { customColumns: customColumns.filter(({ id }) => keepColumn(id)) } : {}),
		...(filters ? { filters: migrateFilters(filters) } : {})
	}
}

import type {
	UnifiedTableV1Config,
	UnifiedTableV1Filters,
	UnifiedTableV2Config
} from '../../../dashboardConfig/persisted'
import type { UnifiedTableFilters } from '../current'
import { migrateUnifiedTableV1ColumnId } from '../unifiedTableV1ColumnPolicy'

function migrateColumnVisibility(visibility: Record<string, boolean>): Record<string, boolean> {
	const migrated: Record<string, boolean> = {}
	for (const id in visibility) {
		const visible = visibility[id]
		if (visible !== undefined) migrated[migrateUnifiedTableV1ColumnId(id)] = visible
	}
	return migrated
}

function migrateExpression(expression: string): string {
	return expression.replace(/[A-Za-z_][A-Za-z0-9_]*/g, migrateUnifiedTableV1ColumnId)
}

function migrateFilters(filters: UnifiedTableV1Filters): UnifiedTableFilters {
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
		...currentFilters
	} = filters

	return {
		...currentFilters,
		...(volumeChange7dMin === undefined ? {} : { volumeChange7dOver7dMin: volumeChange7dMin }),
		...(volumeChange7dMax === undefined ? {} : { volumeChange7dOver7dMax: volumeChange7dMax }),
		...(volumeChange1mMin === undefined ? {} : { volumeChange30dOver30dMin: volumeChange1mMin }),
		...(volumeChange1mMax === undefined ? {} : { volumeChange30dOver30dMax: volumeChange1mMax }),
		...(feesChange7dMin === undefined ? {} : { feesChange7dOver7dMin: feesChange7dMin }),
		...(feesChange7dMax === undefined ? {} : { feesChange7dOver7dMax: feesChange7dMax }),
		...(feesChange1mMin === undefined ? {} : { feesChange30dOver30dMin: feesChange1mMin }),
		...(feesChange1mMax === undefined ? {} : { feesChange30dOver30dMax: feesChange1mMax }),
		...(revenueChange7dMin === undefined ? {} : { revenueChange7dOver7dMin: revenueChange7dMin }),
		...(revenueChange7dMax === undefined ? {} : { revenueChange7dOver7dMax: revenueChange7dMax }),
		...(revenueChange1mMin === undefined ? {} : { revenueChange30dOver30dMin: revenueChange1mMin }),
		...(revenueChange1mMax === undefined ? {} : { revenueChange30dOver30dMax: revenueChange1mMax })
	}
}

export function migrateUnifiedTableV1(config: UnifiedTableV1Config): UnifiedTableV2Config {
	const {
		configVersion: _configVersion,
		columnOrder,
		columnVisibility,
		defaultSorting,
		customColumns,
		filters,
		...rest
	} = config

	return {
		...rest,
		configVersion: 2,
		...(columnOrder ? { columnOrder: columnOrder.map(migrateUnifiedTableV1ColumnId) } : {}),
		...(columnVisibility ? { columnVisibility: migrateColumnVisibility(columnVisibility) } : {}),
		...(defaultSorting
			? {
					defaultSorting: defaultSorting.map(({ id, desc }) => ({
						id: migrateUnifiedTableV1ColumnId(id),
						desc
					}))
				}
			: {}),
		...(customColumns
			? {
					customColumns: customColumns.map((column) => ({
						...column,
						expression: migrateExpression(column.expression)
					}))
				}
			: {}),
		...(filters ? { filters: migrateFilters(filters) } : {})
	}
}

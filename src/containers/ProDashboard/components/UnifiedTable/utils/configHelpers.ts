import type { SortingState, VisibilityState } from '@tanstack/react-table'
import { UNIFIED_TABLE_COLUMN_DICTIONARY } from '../../../unifiedTable/config/columnDictionary'
import type { UnifiedTableConfig } from '../../../unifiedTable/config/current'
import { DEFAULT_COLUMN_ORDER, DEFAULT_COLUMN_VISIBILITY } from '../../../unifiedTable/config/defaults'
import {
	applyUnifiedTableRowHeaderVisibility,
	DEFAULT_UNIFIED_TABLE_ROW_HEADERS,
	normalizeUnifiedTableSorting,
	sanitizeUnifiedTableRowHeaders
} from '../../../unifiedTable/config/layoutPolicy'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import { sanitizeConfigColumns } from '../config/metricCapabilities'
import type { UnifiedTablePreset } from '../config/PresetRegistry'

const ALL_COLUMNS_HIDDEN: Record<string, boolean> = UNIFIED_TABLE_COLUMN_DICTIONARY.reduce<Record<string, boolean>>(
	(acc, column) => {
		acc[column.id] = false
		return acc
	},
	{ name: false }
)

type ColumnOrderConfig = {
	columnOrder?: UnifiedTableConfig['columnOrder']
	customColumns?: UnifiedTableConfig['customColumns']
}

type ColumnVisibilityConfig = ColumnOrderConfig & {
	columnVisibility?: UnifiedTableConfig['columnVisibility']
}

export function getDefaultColumnOrder(
	config: ColumnOrderConfig,
	rowHeaders: readonly UnifiedRowHeaderType[],
	fallbackPreset?: UnifiedTablePreset
): string[] {
	let order: string[]

	if (config.columnOrder && config.columnOrder.length) {
		order = [...config.columnOrder]
	} else if (fallbackPreset) {
		order = [...fallbackPreset.columnOrder]
	} else {
		order = [...DEFAULT_COLUMN_ORDER]
	}

	const sanitized = sanitizeConfigColumns({
		order,
		visibility: {},
		sorting: [],
		customColumns: config.customColumns,
		rowHeaders
	})

	return sanitized.order
}

export function getDefaultColumnVisibility(
	config: ColumnVisibilityConfig,
	rowHeaders: readonly UnifiedRowHeaderType[],
	fallbackPreset?: UnifiedTablePreset,
	includeDefaults: boolean = false
): VisibilityState {
	let visibility: VisibilityState

	if (includeDefaults) {
		visibility = {
			...DEFAULT_COLUMN_VISIBILITY,
			...(fallbackPreset?.columnVisibility ?? {}),
			...(config.columnVisibility ?? {})
		}
	} else {
		const hasColumnVisibility = Boolean(config.columnVisibility && Object.keys(config.columnVisibility).length > 0)
		if (hasColumnVisibility) {
			visibility = {
				...ALL_COLUMNS_HIDDEN,
				...config.columnVisibility
			}
			if (config.columnOrder?.length) {
				for (const colId of config.columnOrder) {
					if (!(colId in (config.columnVisibility ?? {}))) {
						visibility[colId] = true
					}
				}
			}
		} else {
			visibility = {}
		}
	}

	const sanitized = sanitizeConfigColumns({
		order: [],
		visibility,
		sorting: [],
		customColumns: config.customColumns,
		rowHeaders
	})

	return sanitized.visibility
}

export function getDefaultRowHeaders(
	config: UnifiedTableConfig,
	fallbackPreset?: UnifiedTablePreset
): UnifiedRowHeaderType[] {
	if (config.rowHeaders && config.rowHeaders.length) {
		return sanitizeUnifiedTableRowHeaders(config.rowHeaders)
	}

	if (fallbackPreset) {
		return sanitizeUnifiedTableRowHeaders(fallbackPreset.rowHeaders)
	}

	return sanitizeUnifiedTableRowHeaders(DEFAULT_UNIFIED_TABLE_ROW_HEADERS)
}

interface ApplyPresetOptions {
	preset: UnifiedTablePreset
	includeRowHeaderRules?: boolean
	mergeWithDefaults?: boolean
	customColumns?: CustomColumnDefinition[]
}

export function applyPresetToConfig(options: ApplyPresetOptions): {
	columnOrder: string[]
	columnVisibility: VisibilityState
	sorting: SortingState
	rowHeaders: UnifiedRowHeaderType[]
} {
	const { preset, includeRowHeaderRules = true, mergeWithDefaults = true, customColumns } = options

	const rowHeaders = sanitizeUnifiedTableRowHeaders(preset.rowHeaders)

	let columnVisibility = mergeWithDefaults
		? { ...DEFAULT_COLUMN_VISIBILITY, ...preset.columnVisibility }
		: { ...preset.columnVisibility }

	const sanitized = sanitizeConfigColumns({
		order: [...preset.columnOrder],
		visibility: columnVisibility,
		sorting: normalizeUnifiedTableSorting(preset.defaultSorting),
		customColumns,
		rowHeaders
	})

	if (includeRowHeaderRules) {
		sanitized.visibility = applyUnifiedTableRowHeaderVisibility(rowHeaders, sanitized.visibility)
	}

	return {
		columnOrder: sanitized.order,
		columnVisibility: sanitized.visibility,
		sorting: sanitized.sorting,
		rowHeaders
	}
}

import type { SortingState, VisibilityState } from '@tanstack/react-table'
import { UNIFIED_TABLE_COLUMN_DICTIONARY } from '../../../unifiedTable/config/columnDictionary'
import { isColumnAvailableForGrouping } from '../../../unifiedTable/config/groupingCapabilities'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import { isCustomColumnId, validateCustomColumnOnLoad } from '../utils/customColumns'

const SUPPORTED_COLUMN_IDS = new Set<string>(['name'])
for (const column of UNIFIED_TABLE_COLUMN_DICTIONARY) SUPPORTED_COLUMN_IDS.add(column.id)

export function isColumnSupported(
	id: string,
	rowHeaders: readonly UnifiedRowHeaderType[],
	validCustomColumnIds?: Set<string>
): boolean {
	if (isCustomColumnId(id)) {
		if (!validCustomColumnIds) return false
		return validCustomColumnIds.has(id)
	}
	return SUPPORTED_COLUMN_IDS.has(id) && isColumnAvailableForGrouping(id, rowHeaders)
}

function filterByCapabilities(
	ids: string[],
	rowHeaders: readonly UnifiedRowHeaderType[],
	validCustomColumnIds?: Set<string>
): string[] {
	return ids.filter((id) => isColumnSupported(id, rowHeaders, validCustomColumnIds))
}

function pruneVisibility(
	visibility: VisibilityState | undefined,
	rowHeaders: readonly UnifiedRowHeaderType[],
	validCustomColumnIds?: Set<string>
): VisibilityState {
	if (!visibility) return {}
	const result: VisibilityState = {}
	for (const key in visibility) {
		const isVisible = visibility[key]
		if (isVisible !== undefined && isColumnSupported(key, rowHeaders, validCustomColumnIds)) result[key] = isVisible
	}
	return result
}

function sanitizeSorting(
	sorting: SortingState | undefined,
	rowHeaders: readonly UnifiedRowHeaderType[],
	validCustomColumnIds?: Set<string>
): SortingState {
	if (!sorting) return []
	return sorting.filter((sort) => isColumnSupported(sort.id, rowHeaders, validCustomColumnIds))
}

function getValidCustomColumnIds(customColumns?: CustomColumnDefinition[]): Set<string> {
	const validIds = new Set<string>()
	for (const column of customColumns ?? []) {
		if (isCustomColumnId(column.id) && validateCustomColumnOnLoad(column).isValid) validIds.add(column.id)
	}
	return validIds
}

export function sanitizeConfigColumns({
	order,
	visibility,
	sorting,
	customColumns,
	rowHeaders
}: {
	order: string[]
	visibility?: VisibilityState
	sorting?: SortingState
	customColumns?: CustomColumnDefinition[] | undefined
	rowHeaders: readonly UnifiedRowHeaderType[]
}): {
	order: string[]
	visibility: VisibilityState
	sorting: SortingState
} {
	const validCustomColumnIds = getValidCustomColumnIds(customColumns)
	return {
		order: filterByCapabilities(order, rowHeaders, validCustomColumnIds),
		visibility: pruneVisibility(visibility, rowHeaders, validCustomColumnIds),
		sorting: sanitizeSorting(sorting, rowHeaders, validCustomColumnIds)
	}
}

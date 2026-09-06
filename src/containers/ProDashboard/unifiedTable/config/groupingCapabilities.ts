import { COLUMN_DICTIONARY_BY_ID } from './columnDictionary'
import type { UnifiedTableFilters } from './current'
import type { UnifiedRowHeaderType } from './types'

export function hasCanonicalChainGrouping(rowHeaders: ReadonlyArray<UnifiedRowHeaderType>): boolean {
	return rowHeaders[0] === 'chain'
}

export function isColumnAvailableForGrouping(
	columnId: string,
	rowHeaders: ReadonlyArray<UnifiedRowHeaderType>
): boolean {
	return hasCanonicalChainGrouping(rowHeaders) || COLUMN_DICTIONARY_BY_ID.get(columnId)?.chainGroupOnly !== true
}

export function sanitizeFiltersForGrouping(
	filters: UnifiedTableFilters | undefined,
	rowHeaders: ReadonlyArray<UnifiedRowHeaderType>
): UnifiedTableFilters | undefined {
	if (!filters || hasCanonicalChainGrouping(rowHeaders)) return filters

	const {
		stablesMcapMin: _stablesMcapMin,
		stablesMcapMax: _stablesMcapMax,
		bridgedTvlMin: _bridgedTvlMin,
		bridgedTvlMax: _bridgedTvlMax,
		hasBridgedTVL: _hasBridgedTVL,
		hasStables: _hasStables,
		...availableFilters
	} = filters
	for (const _key in availableFilters) return availableFilters
	return undefined
}

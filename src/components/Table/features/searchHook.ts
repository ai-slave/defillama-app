import { createTableHook } from '@tanstack/react-table'
import { searchTableFeatures } from './search'

/** Table options every search table starts from; a test builds the same table from them. */
export const searchTableOptions = {
	features: searchTableFeatures,
	defaultColumn: { sortUndefined: 'last' as const },
	enableSortingRemoval: false,
	filterFromLeafRows: true
}

export const { useAppTable: useSearchTable } = createTableHook(searchTableOptions)

import { createTableHook } from '@tanstack/react-table'
import { searchTableFeatures } from './search'

export const { useAppTable: useSearchTable } = createTableHook({
	features: searchTableFeatures,
	defaultColumn: { sortUndefined: 'last' },
	enableSortingRemoval: false,
	filterFromLeafRows: true
})

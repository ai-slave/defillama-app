import {
	createSortedRowModel,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	tableFeatures
} from '@tanstack/react-table'

// Automatic sorting chooses among these four functions from the column's values.
export const sortingFeatures = tableFeatures({
	rowSortingFeature,
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		datetime: sortFn_datetime,
		text: sortFn_text
	}
})

export const sortedTableFeatures = tableFeatures({
	...sortingFeatures,
	sortedRowModel: createSortedRowModel()
})

export type SortedTableFeatures = typeof sortedTableFeatures

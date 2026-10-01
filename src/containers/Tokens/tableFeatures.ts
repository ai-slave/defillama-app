import {
	columnSizingFeature,
	rowExpandingFeature,
	rowPaginationFeature,
	tableFeatures,
	type TableFeatures
} from '@tanstack/react-table'
import { columnVisibilityFeature } from '~/components/Table/features/display'
import { sortingFeatures } from '~/components/Table/features/sorting'

export const tokenTableFeatures = tableFeatures({
	...sortingFeatures,
	columnSizingFeature,
	columnVisibilityFeature,
	rowExpandingFeature,
	rowPaginationFeature
})

// The same columns serve server pages and the locally processed watchlist.
// Optional processing slots preserve their type contract without importing client models on the server-driven page.
export type TokenTableFeatures = typeof tokenTableFeatures &
	Pick<TableFeatures, 'sortedRowModel' | 'expandedRowModel' | 'paginatedRowModel'>

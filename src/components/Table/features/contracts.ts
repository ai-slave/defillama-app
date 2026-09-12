import type { ReadonlyAtom } from '@tanstack/react-store'
import type {
	PaginationState,
	ColumnOrderState,
	RowData,
	Table_ColumnOrdering,
	Table_Core,
	Table_RowPagination,
	TableFeature,
	TableFeatures
} from '@tanstack/react-table'

export type SortingFeatures = { rowSortingFeature: TableFeature }
export type VisibilityFeatures = { columnVisibilityFeature: TableFeature }
export type PaginationFeatures = { rowPaginationFeature: TableFeature }
export type FilteringFeatures = { columnFilteringFeature: TableFeature }
export type OrderingFeatures = { columnOrderingFeature: TableFeature }

// Keep the concrete feature parameter: Table<MinimumFeatures, T> cannot accept a
// table with additional features because v9's core table types are invariant.
export type PaginatedTableInstance<F extends PaginationFeatures, T extends RowData> = Table_Core<F, T> &
	Table_RowPagination<F, T> & { atoms: { pagination: ReadonlyAtom<PaginationState> } }

export type OrderedTableInstance<F extends TableFeatures & OrderingFeatures, T extends RowData> = Table_Core<F, T> &
	Table_ColumnOrdering<F, T> & { atoms: { columnOrder: ReadonlyAtom<ColumnOrderState> } }

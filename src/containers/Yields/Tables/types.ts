import type { PaginationState, SortingState } from '@tanstack/react-table'
import type { EarnPageRow } from '../data/types'

export type IYieldTableRow = EarnPageRow
export type YieldPoolTableRow = EarnPageRow
export type YieldsTableAppearance = 'standalone' | 'embedded'

export interface IYieldsTableProps<TRow = EarnPageRow> {
	data: Array<TRow>
	initialPageSize?: number
	initialPageIndex?: number
	rowCount?: number
	manualPagination?: boolean
	manualSorting?: boolean
	paginationState?: PaginationState
	sortingState?: SortingState
	onPaginationChange?: (paginationState: PaginationState) => void
	onSortingChange?: (sortingState: SortingState) => void
	interactionDisabled?: boolean
	loadingLabel?: string
}

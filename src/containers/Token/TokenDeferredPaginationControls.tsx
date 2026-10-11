import { TablePager } from '~/components/Table/TablePager'
import { LoadingSpinner } from '~/ui/Loaders'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'

export function TokenDeferredPaginationControls({
	totalCount,
	pageSize = DEFAULT_TABLE_PAGE_SIZE,
	isLoading,
	onRequestPage
}: {
	totalCount: number
	pageSize?: number
	isLoading?: boolean
	onRequestPage: (pageIndex: number) => void
}) {
	const pageCount = Math.ceil(totalCount / pageSize)
	if (pageCount <= 1) return null

	// Next and Last load the full table, which replaces this pager with the table's own; TablePager hands focus to the
	// section around it (a `tabIndex={-1}` region), which stays through the swap and an empty result alike.
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<TablePager pageIndex={0} pageCount={pageCount} onPageChange={onRequestPage} disabled={isLoading} />
			{isLoading ? (
				<div className="flex items-center gap-2 label-sm text-secondary">
					<LoadingSpinner size={12} />
					<span>Loading full table…</span>
				</div>
			) : null}
		</div>
	)
}

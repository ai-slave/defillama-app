import { TablePager } from '~/components/Table/TablePager'
import { BusyGlyph } from '~/ui/Status'
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
				<div className="label-sm text-secondary">
					{/* The table's loading overlay announces the same wait. */}
					<BusyGlyph label="Loading full table…" size={12} insideLiveRegion />
				</div>
			) : null}
		</div>
	)
}

import { TagGroup } from '~/ui/SegmentedControl'

interface TablePaginationProps {
	pageSize: number
	pageIndex: number
	pageCount: number
	canPreviousPage: boolean
	canNextPage: boolean
	previousPage: () => void
	nextPage: () => void
	setPageSize: (pageSize: number) => void
	showPageSizes: boolean
}

const PAGE_SIZES = ['10', '30', '50'] as const
type PageSize = (typeof PAGE_SIZES)[number]
const PAGE_SIZE_VALUES: Record<PageSize, number> = { '10': 10, '30': 30, '50': 50 }

function toPageSize(pageSize: number): PageSize {
	if (pageSize === 30) return '30'
	if (pageSize === 50) return '50'
	return '10'
}

export function TablePagination({
	pageSize,
	pageIndex,
	pageCount,
	canPreviousPage,
	canNextPage,
	previousPage,
	nextPage,
	setPageSize,
	showPageSizes
}: TablePaginationProps) {
	if (pageIndex >= pageCount) return null
	const shouldShowPagination = canPreviousPage || canNextPage
	if (!shouldShowPagination && !showPageSizes) return null

	return (
		<div className="mt-2 flex w-full items-center justify-between">
			{shouldShowPagination ? (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={previousPage}
						disabled={!canPreviousPage}
						className="rounded-md border border-subtle px-2 py-1 text-sm text-pro-text-secondary transition-colors hover:bg-border-subtle disabled:cursor-not-allowed disabled:opacity-50"
					>
						Previous
					</button>
					<span className="text-xs text-pro-text-secondary">
						Page {pageIndex + 1} of {pageCount}
					</span>
					<button
						type="button"
						onClick={nextPage}
						disabled={!canNextPage}
						className="rounded-md border border-subtle px-2 py-1 text-sm text-pro-text-secondary transition-colors hover:bg-border-subtle disabled:cursor-not-allowed disabled:opacity-50"
					>
						Next
					</button>
				</div>
			) : null}
			{showPageSizes ? (
				<div className="flex items-center">
					<span className="mr-2 text-xs">Per page</span>
					<TagGroup
						variant="default"
						size="md"
						selectedValue={toPageSize(pageSize)}
						values={PAGE_SIZES}
						setValue={(value) => setPageSize(PAGE_SIZE_VALUES[value])}
					/>
				</div>
			) : null}
		</div>
	)
}

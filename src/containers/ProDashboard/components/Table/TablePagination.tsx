import { Button } from '~/ui/Button'
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
		<div className="mt-2 flex w-full flex-wrap items-center justify-between gap-2">
			{shouldShowPagination ? (
				<div className="flex items-center gap-2">
					<Button size="md" onClick={previousPage} disabled={!canPreviousPage} accessibleWhenDisabled>
						Previous
					</Button>
					<span className="body-sm text-secondary">
						Page {pageIndex + 1} of {pageCount}
					</span>
					<Button size="md" onClick={nextPage} disabled={!canNextPage} accessibleWhenDisabled>
						Next
					</Button>
				</div>
			) : null}
			{showPageSizes ? (
				<div className="flex items-center gap-2">
					<span className="body-sm">Per page</span>
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

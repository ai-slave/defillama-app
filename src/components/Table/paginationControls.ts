export function getPaginationControls({
	rowCount,
	pageCount,
	pageIndex,
	pageSize,
	pageSizeOptions
}: {
	rowCount: number
	pageCount: number
	pageIndex: number
	pageSize: number
	pageSizeOptions: ReadonlyArray<number>
}) {
	const displayPageCount = Math.max(1, pageCount)
	const displayPageIndex = pageCount === 0 ? 0 : Math.min(pageIndex, displayPageCount - 1)
	// A page size set outside the configured options stays selectable instead of silently snapping.
	const availablePageSizeOptions = pageSizeOptions.includes(pageSize)
		? pageSizeOptions
		: [...pageSizeOptions, pageSize].sort((a, b) => a - b)

	return {
		showNavigation: rowCount > 10 && pageCount > 1,
		showPageSizeSelector: rowCount > 10 && availablePageSizeOptions.length >= 2,
		pageLabel: `Page ${displayPageIndex + 1} of ${displayPageCount}`,
		pageSizeOptions: availablePageSizeOptions
	}
}

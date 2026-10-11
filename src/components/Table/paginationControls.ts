export function getPaginationControls({
	rowCount,
	pageCount,
	pageSize,
	pageSizeOptions
}: {
	rowCount: number
	pageCount: number
	pageSize: number
	pageSizeOptions: ReadonlyArray<number>
}) {
	// A page size set outside the configured options stays selectable instead of silently snapping.
	const availablePageSizeOptions = pageSizeOptions.includes(pageSize)
		? pageSizeOptions
		: [...pageSizeOptions, pageSize].sort((a, b) => a - b)

	return {
		showNavigation: rowCount > 10 && pageCount > 1,
		showPageSizeSelector: rowCount > 10 && availablePageSizeOptions.length >= 2,
		pageSizeOptions: availablePageSizeOptions
	}
}

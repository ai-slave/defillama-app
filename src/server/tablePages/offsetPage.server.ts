import type { OffsetTablePage } from './types'

/**
 * Offset windowing for discrete prev/next tables. Correct only when the UI
 * shows one page at a time: a dataset version rolling over between requests
 * shifts rows across page boundaries, which a paged UI tolerates. If pages
 * accumulate (infinite scroll), use cursorPage.server.ts instead.
 */
export function offsetTablePage<Row>({
	rows,
	page,
	pageSize,
	maxPageSize
}: {
	/** Prepared (already filtered + sorted) rows for the query. */
	rows: Array<Row>
	/** 1-based requested page. Values below 1 clamp to 1; pages past the end return no rows. */
	page: number
	/** Rows per page, or 'all' for the complete set (gate 'all' at the route if unwanted). */
	pageSize: number | 'all'
	maxPageSize: number
}): OffsetTablePage<Row> {
	const total = rows.length
	if (pageSize === 'all') {
		return { rows, page: 1, pageSize: total, total, totalPages: 1, hasMore: false }
	}
	const size = Math.max(1, Math.min(maxPageSize, Math.trunc(pageSize)))
	const safePage = Math.max(1, Math.trunc(page))
	const start = (safePage - 1) * size
	return {
		rows: rows.slice(start, start + size),
		page: safePage,
		pageSize: size,
		total,
		totalPages: Math.max(1, Math.ceil(total / size)),
		hasMore: start + size < total
	}
}

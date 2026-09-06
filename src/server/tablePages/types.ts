/**
 * Shared shapes for server-paginated tables. Browser-safe: the client hook
 * imports page shapes from here, so nothing in this file may touch Node APIs.
 *
 * See src/server/tablePages/README.md for the delivery-tier decision rule.
 */

export type TablePageOrder = 'asc' | 'desc'

/** The comparable value a sort accessor extracts from a row. Nulls always sort last. */
export type TableSortValue = string | number | boolean | null

/** One page of a cursor-mode (accumulating / infinite-scroll) table. */
export type CursorTablePage<Row> = {
	rows: Array<Row>
	nextCursor: string | null
	version: string
	total: number
	hasMore: boolean
}

/** One page of an offset-mode (discrete prev/next) table. */
export type OffsetTablePage<Row> = {
	rows: Array<Row>
	page: number
	pageSize: number
	total: number
	totalPages: number
	hasMore: boolean
}

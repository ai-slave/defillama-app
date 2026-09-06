import type { CursorTablePage, TablePageOrder, TableSortValue } from './types'

/**
 * Cursor windowing for accumulating (infinite-scroll) tables.
 *
 * A cursor names the dataset version and query it was minted against and the
 * exact row it stopped on. Serving a page re-verifies all of it: version and
 * query hash by equality, the boundary row by identity AND sort value. A
 * dataset that shifted produces an explicit error, never a silently skipped
 * or repeated row — the guarantee offset pagination cannot give an
 * accumulating UI.
 *
 * The caller supplies rows already sorted by a TOTAL, deterministic order
 * (nulls last via compareTableSortValues, ties broken on rowId) — without a
 * total order, equal-valued rows could swap between requests and the boundary
 * check would reject valid cursors.
 */

export class TableCursorError extends Error {}

type CursorPayload = {
	v: 2
	// Wire field name predates the kernel ("snapshot", not "version") and is
	// kept so cursors minted before a deploy keep resolving after it.
	snapshot: string
	queryHash: string
	lastValue: TableSortValue
	lastId: string
	offset: number
}

/** Total order over sort values: nulls always last regardless of direction. */
export function compareTableSortValues(a: TableSortValue, b: TableSortValue, order: TablePageOrder): number {
	if (a === null && b === null) return 0
	if (a === null) return 1
	if (b === null) return -1
	const comparison = a < b ? -1 : a > b ? 1 : 0
	return order === 'desc' ? -comparison : comparison
}

function encodeCursor(payload: CursorPayload): string {
	return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(cursor: string): CursorPayload | null {
	try {
		const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
		const value = parsed as Partial<CursorPayload>
		if (
			value.v !== 2 ||
			typeof value.snapshot !== 'string' ||
			typeof value.queryHash !== 'string' ||
			value.queryHash.length !== 22 ||
			typeof value.lastId !== 'string' ||
			typeof value.offset !== 'number' ||
			!Number.isSafeInteger(value.offset) ||
			value.offset < 1 ||
			(value.lastValue !== null &&
				typeof value.lastValue !== 'string' &&
				typeof value.lastValue !== 'number' &&
				typeof value.lastValue !== 'boolean')
		) {
			return null
		}
		return value as CursorPayload
	} catch {
		return null
	}
}

export function cursorTablePage<Row>({
	rows: sorted,
	version,
	queryHash,
	cursor = null,
	limit,
	maxLimit,
	order,
	rowId,
	sortValue
}: {
	/** Prepared rows in a total, deterministic order (see module comment). */
	rows: Array<Row>
	/** The immutable dataset version the rows come from. */
	version: string
	/** hashTableQuerySignature(schema.signature(query)) — 22 chars. */
	queryHash: string
	cursor?: string | null
	limit: number
	maxLimit: number
	order: TablePageOrder
	/** Stable row identity used for boundary verification and tie-breaks. */
	rowId: (row: Row) => string
	/** The row's value under the query's sort, for boundary verification. */
	sortValue: (row: Row) => TableSortValue
}): CursorTablePage<Row> {
	const safeLimit = Math.max(1, Math.min(maxLimit, Math.trunc(limit)))
	let start = 0
	if (cursor) {
		const decoded = decodeCursor(cursor)
		if (!decoded || decoded.snapshot !== version || decoded.queryHash !== queryHash) {
			throw new TableCursorError('The cursor does not match this dataset version and query')
		}
		const previous = sorted[decoded.offset - 1]
		if (
			!previous ||
			rowId(previous) !== decoded.lastId ||
			compareTableSortValues(sortValue(previous), decoded.lastValue, order) !== 0
		) {
			throw new TableCursorError('The cursor position is invalid')
		}
		start = decoded.offset
	}
	const rows = sorted.slice(start, start + safeLimit)
	const hasMore = start + rows.length < sorted.length
	const lastRow = rows.at(-1)
	const nextCursor =
		hasMore && lastRow
			? encodeCursor({
					v: 2,
					snapshot: version,
					queryHash,
					lastValue: sortValue(lastRow),
					lastId: rowId(lastRow),
					offset: start + rows.length
				})
			: null

	return { rows, nextCursor, version, total: sorted.length, hasMore }
}

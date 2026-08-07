import { describe, expect, it } from 'vitest'
import { compareTableSortValues, cursorTablePage, TableCursorError } from '../cursorPage.server'
import { hashTableQuerySignature } from '../preparedRows.server'

type Row = { id: string; tvl: number | null }

const rowId = (row: Row) => row.id
const sortValue = (row: Row) => row.tvl
const queryHash = hashTableQuerySignature('{"sort":"tvl","order":"desc"}')

function sortedRows(rows: Row[]): Row[] {
	return rows.toSorted(
		(a, b) => compareTableSortValues(a.tvl, b.tvl, 'desc') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
	)
}

function page(rows: Row[], options: { cursor?: string | null; limit?: number; version?: string; hash?: string } = {}) {
	return cursorTablePage({
		rows,
		version: options.version ?? 'v-stable',
		queryHash: options.hash ?? queryHash,
		cursor: options.cursor ?? null,
		limit: options.limit ?? 2,
		maxLimit: 100,
		order: 'desc',
		rowId,
		sortValue
	})
}

describe('cursorTablePage', () => {
	it('pages through equal-valued rows without skips or duplicates', () => {
		const rows = sortedRows([
			{ id: 'c', tvl: 10 },
			{ id: 'a', tvl: 10 },
			{ id: 'b', tvl: 10 },
			{ id: 'd', tvl: 9 }
		])
		const first = page(rows)
		const second = page(rows, { cursor: first.nextCursor })

		expect(first.rows.map(rowId)).toEqual(['a', 'b'])
		expect(second.rows.map(rowId)).toEqual(['c', 'd'])
		expect(second.nextCursor).toBeNull()
		expect(second.hasMore).toBe(false)
	})

	it('sorts nulls last in either direction', () => {
		expect(compareTableSortValues(null, 1, 'desc')).toBeGreaterThan(0)
		expect(compareTableSortValues(null, 1, 'asc')).toBeGreaterThan(0)
		expect(compareTableSortValues(null, null, 'desc')).toBe(0)
		expect(compareTableSortValues(2, 1, 'desc')).toBeLessThan(0)
		expect(compareTableSortValues(2, 1, 'asc')).toBeGreaterThan(0)
	})

	it('rejects a cursor minted against another version or query', () => {
		const rows = sortedRows([
			{ id: 'a', tvl: 2 },
			{ id: 'b', tvl: 1 }
		])
		const first = page(rows, { limit: 1 })

		expect(() => page(rows, { cursor: first.nextCursor, version: 'v-new' })).toThrow(TableCursorError)
		expect(() => page(rows, { cursor: first.nextCursor, hash: hashTableQuerySignature('{"sort":"fees"}') })).toThrow(
			TableCursorError
		)
	})

	it('rejects a cursor whose boundary no longer matches the row order', () => {
		const rows = sortedRows([
			{ id: 'a', tvl: 2 },
			{ id: 'b', tvl: 1 }
		])
		const first = page(rows, { limit: 1 })
		const payload = JSON.parse(Buffer.from(first.nextCursor ?? '', 'base64url').toString('utf8'))

		const movedOffset = Buffer.from(JSON.stringify({ ...payload, offset: 2 })).toString('base64url')
		expect(() => page(rows, { cursor: movedOffset, limit: 1 })).toThrow(TableCursorError)

		const changedValue = Buffer.from(JSON.stringify({ ...payload, lastValue: 3 })).toString('base64url')
		expect(() => page(rows, { cursor: changedValue, limit: 1 })).toThrow(TableCursorError)

		expect(() => page(rows, { cursor: 'not-base64-json', limit: 1 })).toThrow(TableCursorError)
	})

	it('clamps the limit into [1, maxLimit]', () => {
		const rows = sortedRows(Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, tvl: 5 - index })))
		expect(page(rows, { limit: 0 }).rows).toHaveLength(1)
		expect(
			cursorTablePage({
				rows,
				version: 'v-stable',
				queryHash,
				limit: 500,
				maxLimit: 3,
				order: 'desc',
				rowId,
				sortValue
			}).rows
		).toHaveLength(3)
	})

	it('keeps cursors compact regardless of query size via the fixed-width hash', () => {
		const rows = sortedRows([
			{ id: 'a', tvl: 2 },
			{ id: 'b', tvl: 1 }
		])
		const first = page(rows, { limit: 1, hash: hashTableQuerySignature(`{"formula":"${'1+'.repeat(249)}1"}`) })
		expect(first.nextCursor?.length ?? 0).toBeLessThan(250)
	})
})

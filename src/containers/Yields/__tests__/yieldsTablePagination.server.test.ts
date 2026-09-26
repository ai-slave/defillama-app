import { describe, expect, test } from 'vitest'
import { sliceYieldsPage, sortYieldsRows } from '../yieldsTablePagination.server'
import { MAX_YIELDS_TABLE_PAGE_SIZE } from '../yieldsTableQuery'

interface TestRow {
	id: string
	apy?: number | null
	label?: string | null
	funding?: string | null
	nested?: {
		score?: number | null
	}
}

const sortAccessors = {
	apy: (row: TestRow) => row.apy,
	label: (row: TestRow) => row.label,
	funding: (row: TestRow) => row.funding,
	score: (row: TestRow) => row.nested?.score
}

describe('sliceYieldsPage', () => {
	test('uses default pagination when query params are absent', () => {
		const rows = Array.from({ length: 60 }, (_, index) => ({ id: String(index), apy: index }))

		const result = sliceYieldsPage(rows, {})

		expect(result).toMatchObject({ total: 60, page: 1, pageSize: 50, hasMore: true })
		expect(result.rows).toHaveLength(50)
		expect(result.rows[0]?.id).toBe('0')
	})

	test('honors page and pageSize query params', () => {
		const rows = Array.from({ length: 12 }, (_, index) => ({ id: String(index), apy: index }))

		const result = sliceYieldsPage(rows, { page: '2', pageSize: '5' })

		expect(result).toMatchObject({ total: 12, page: 2, pageSize: 5, hasMore: true })
		expect(result.rows.map((row) => row.id)).toEqual(['5', '6', '7', '8', '9'])
	})

	test('caps regular pageSize query params', () => {
		const rows = Array.from({ length: MAX_YIELDS_TABLE_PAGE_SIZE + 10 }, (_, index) => ({
			id: String(index),
			apy: index
		}))

		const result = sliceYieldsPage(rows, { pageSize: '999999' })

		expect(result).toMatchObject({
			total: MAX_YIELDS_TABLE_PAGE_SIZE + 10,
			page: 1,
			pageSize: MAX_YIELDS_TABLE_PAGE_SIZE,
			hasMore: true
		})
		expect(result.rows).toHaveLength(MAX_YIELDS_TABLE_PAGE_SIZE)
	})

	test('returns the full filtered set for pageSize=all', () => {
		const rows = Array.from({ length: 12 }, (_, index) => ({ id: String(index), apy: index }))

		const result = sliceYieldsPage(rows, { page: '2', pageSize: 'all' })

		expect(result).toMatchObject({ total: 12, page: 1, pageSize: 12, hasMore: false })
		expect(result.rows).toHaveLength(12)
	})

	test('clamps out-of-range pages to the last available page', () => {
		const rows = Array.from({ length: 12 }, (_, index) => ({ id: String(index), apy: index }))

		const result = sliceYieldsPage(rows, { page: '99', pageSize: '5' })

		expect(result).toMatchObject({ total: 12, page: 3, pageSize: 5, hasMore: false })
		expect(result.rows.map((row) => row.id)).toEqual(['10', '11'])
	})
})

describe('sortYieldsRows', () => {
	test('keeps stable ties and places missing values last', () => {
		const rows: Array<TestRow> = [
			{ id: 'missing', apy: null },
			{ id: 'first-tie', apy: 10 },
			{ id: 'second-tie', apy: 10 },
			{ id: 'low', apy: 1 }
		]

		const result = sortYieldsRows({
			rows,
			query: { sortBy: 'apy', sortDesc: 'true' },
			sortAccessors
		})

		expect(result.map((row) => row.id)).toEqual(['first-tie', 'second-tie', 'low', 'missing'])
	})

	test('sorts numeric strings numerically', () => {
		const rows: Array<TestRow> = [
			{ id: 'negative', funding: '-0.500' },
			{ id: 'two', funding: '2.000' },
			{ id: 'ten', funding: '10.000' }
		]

		const result = sortYieldsRows({
			rows,
			query: { sortBy: 'funding', sortDesc: 'true' },
			sortAccessors
		})

		expect(result.map((row) => row.id)).toEqual(['ten', 'two', 'negative'])
	})

	test('keeps mixed numeric-string and text sorting transitive', () => {
		const rows: Array<TestRow> = [
			{ id: 'text', funding: '85abc' },
			{ id: 'nine', funding: '9' },
			{ id: 'eighty', funding: '80' }
		]

		const result = sortYieldsRows({
			rows,
			query: { sortBy: 'funding', sortDesc: 'false' },
			sortAccessors
		})

		expect(result.map((row) => row.id)).toEqual(['nine', 'eighty', 'text'])
	})

	test('ignores invalid sort keys when no fallback accessor is provided', () => {
		const rows: Array<TestRow> = [
			{ id: 'first', apy: 1 },
			{ id: 'second', apy: 2 }
		]

		const result = sortYieldsRows({
			rows,
			query: { sortBy: 'missing', sortDesc: 'true' },
			sortAccessors
		})

		expect(result.map((row) => row.id)).toEqual(['first', 'second'])
	})

	test('uses the route default sort when the requested sort key is invalid', () => {
		const rows: Array<TestRow> = [
			{ id: 'first', nested: { score: 1 } },
			{ id: 'second', nested: { score: 2 } }
		]

		const result = sortYieldsRows({
			rows,
			query: { sortBy: 'missing', sortDesc: 'true' },
			sortAccessors,
			defaultSort: { sortBy: 'score', sortDesc: true }
		})

		expect(result.map((row) => row.id)).toEqual(['second', 'first'])
	})

	test('supports top-level fallback accessors for legacy pool sort compatibility', () => {
		const rows: Array<TestRow> = [
			{ id: 'first', apy: 1 },
			{ id: 'second', apy: 2 }
		]

		const result = sortYieldsRows<TestRow, string>({
			rows,
			query: { sortBy: 'apy', sortDesc: 'true' },
			fallbackSortAccessor: (row, sortBy) => row[sortBy as keyof TestRow]
		})

		expect(result.map((row) => row.id)).toEqual(['second', 'first'])
	})
})

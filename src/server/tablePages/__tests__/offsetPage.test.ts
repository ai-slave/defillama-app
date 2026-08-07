import { describe, expect, it } from 'vitest'
import { offsetTablePage } from '../offsetPage.server'

const rows = Array.from({ length: 7 }, (_, index) => `row-${index}`)

describe('offsetTablePage', () => {
	it('slices 1-based pages and reports totals', () => {
		const first = offsetTablePage({ rows, page: 1, pageSize: 3, maxPageSize: 100 })
		const last = offsetTablePage({ rows, page: 3, pageSize: 3, maxPageSize: 100 })

		expect(first.rows).toEqual(['row-0', 'row-1', 'row-2'])
		expect(first).toMatchObject({ page: 1, pageSize: 3, total: 7, totalPages: 3, hasMore: true })
		expect(last.rows).toEqual(['row-6'])
		expect(last.hasMore).toBe(false)
	})

	it('clamps page and pageSize into valid ranges', () => {
		expect(offsetTablePage({ rows, page: 0, pageSize: 0, maxPageSize: 100 })).toMatchObject({ page: 1, pageSize: 1 })
		expect(offsetTablePage({ rows, page: 1, pageSize: 500, maxPageSize: 4 }).rows).toHaveLength(4)
	})

	it('returns an empty page past the end rather than clamping backwards', () => {
		const past = offsetTablePage({ rows, page: 9, pageSize: 3, maxPageSize: 100 })
		expect(past.rows).toEqual([])
		expect(past.hasMore).toBe(false)
	})

	it("returns everything for pageSize 'all'", () => {
		const all = offsetTablePage({ rows, page: 5, pageSize: 'all', maxPageSize: 4 })
		expect(all.rows).toEqual(rows)
		expect(all).toMatchObject({ page: 1, totalPages: 1, hasMore: false })
	})

	it('handles an empty row set', () => {
		expect(offsetTablePage({ rows: [], page: 1, pageSize: 10, maxPageSize: 100 })).toMatchObject({
			rows: [],
			total: 0,
			totalPages: 1,
			hasMore: false
		})
	})
})

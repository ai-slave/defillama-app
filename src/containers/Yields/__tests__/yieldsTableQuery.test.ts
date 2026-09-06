import { describe, expect, test } from 'vitest'
import {
	buildYieldsTableQueryString,
	getYieldsTablePaginationFromQuery,
	MAX_YIELDS_TABLE_PAGE_SIZE
} from '../yieldsTableQuery'

describe('yields table query helpers', () => {
	test('caps parsed page sizes for regular table requests', () => {
		expect(getYieldsTablePaginationFromQuery({ pageSize: '999999' })).toEqual({
			pageIndex: 0,
			pageSize: MAX_YIELDS_TABLE_PAGE_SIZE
		})
	})

	test('caps serialized numeric page sizes but preserves CSV all requests', () => {
		expect(
			buildYieldsTableQueryString({
				query: {},
				pagination: { pageIndex: 0, pageSize: 999_999 },
				sorting: []
			})
		).toBe(`?page=1&pageSize=${MAX_YIELDS_TABLE_PAGE_SIZE}`)

		expect(
			buildYieldsTableQueryString({
				query: {},
				pagination: { pageIndex: 0, pageSize: 999_999 },
				sorting: [],
				pageSize: 'all'
			})
		).toBe('?page=1&pageSize=all')
	})
})

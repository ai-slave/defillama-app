import type { ParsedUrlQuery } from 'node:querystring'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import { parseNumberQueryParam, readSingleQueryValue, toQueryString } from '~/utils/routerQuery'

/** Query params that pick a window of a prepared row set instead of changing it. */
export const YIELDS_PAGING_PARAMS = ['page', 'pageSize'] as const

export const DEFAULT_YIELDS_TABLE_PAGE_SIZE = 50
// Regular table pages are capped; CSV exports bypass this with pageSize=all.
export const MAX_YIELDS_TABLE_PAGE_SIZE = 500

export type YieldsPaginatedTableResponse<TRow> = {
	rows: Array<TRow>
	total: number
	page: number
	pageSize: number
	hasMore: boolean
	// Median APY of the full filtered set, all pages (earn route only).
	medianApy?: number | null
	// Min chips for each range filter the route serves, from `rangeQuickPicks`: earn has TVL and APY,
	// the borrow and loop routes have available liquidity.
	tvlQuickPicks?: Array<number>
	apyQuickPicks?: Array<number>
	availableQuickPicks?: Array<number>
}

function parsePositiveIntegerQueryParam(value: ParsedUrlQuery[string], fallback: number): number {
	const parsed = parseNumberQueryParam(value)
	return parsed != null && parsed > 0 ? Math.floor(parsed) : fallback
}

export function getYieldsTablePaginationFromQuery(query: ParsedUrlQuery): PaginationState {
	const page = parsePositiveIntegerQueryParam(query.page, 1)
	const pageSize = Math.min(
		parsePositiveIntegerQueryParam(query.pageSize, DEFAULT_YIELDS_TABLE_PAGE_SIZE),
		MAX_YIELDS_TABLE_PAGE_SIZE
	)

	return {
		pageIndex: page - 1,
		pageSize
	}
}

export function getYieldsTableSortingFromQuery(query: ParsedUrlQuery, defaultSorting: SortingState = []): SortingState {
	const sortBy = readSingleQueryValue(query.sortBy)
	if (!sortBy) return defaultSorting

	return [
		{
			id: sortBy,
			desc: readSingleQueryValue(query.sortDesc) !== 'false'
		}
	]
}

export function buildYieldsTableQueryString({
	query,
	pagination,
	sorting,
	pageSize,
	extraQuery
}: {
	query: Record<string, string | Array<string> | undefined>
	pagination: PaginationState
	sorting: SortingState
	pageSize?: number | 'all'
	extraQuery?: Record<string, string | Array<string> | undefined>
}) {
	const sort = sorting[0]
	const nextPageSize =
		pageSize === 'all' ? 'all' : String(Math.min(pageSize ?? pagination.pageSize, MAX_YIELDS_TABLE_PAGE_SIZE))
	return toQueryString({
		...query,
		...extraQuery,
		page: String(pagination.pageIndex + 1),
		pageSize: nextPageSize,
		sortBy: sort?.id,
		sortDesc: sort ? String(sort.desc) : undefined
	})
}

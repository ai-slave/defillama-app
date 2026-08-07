import type { PaginationState, SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { useYieldsPaginatedTable } from './queries.client'
import { pushYieldsQuery } from './queryUpdates.client'
import type { IYieldsTableProps } from './Tables/types'
import type { YieldsPaginatedTableResponse } from './yieldsTableQuery'
import {
	buildYieldsTableQueryString,
	DEFAULT_YIELDS_TABLE_PAGE_SIZE,
	getYieldsTablePaginationFromQuery,
	getYieldsTableSortingFromQuery
} from './yieldsTableQuery'

type QueryRecord = Record<string, string | string[] | undefined>

export function useYieldsServerTable<TRow>({
	endpoint,
	enabled = true,
	extraQuery,
	defaultSorting = [],
	initialData,
	initialDataUpdatedAt
}: {
	endpoint: string
	enabled?: boolean
	extraQuery?: QueryRecord
	defaultSorting?: SortingState
	/** ISR-provided first page of the DEFAULT view; ignored for parameterized URLs. */
	initialData?: YieldsPaginatedTableResponse<TRow>
	initialDataUpdatedAt?: number
}) {
	const router = useRouter()
	const query = router.query as QueryRecord
	const requestedPagination = React.useMemo(() => getYieldsTablePaginationFromQuery(query), [query])
	const sorting = React.useMemo(() => getYieldsTableSortingFromQuery(query, defaultSorting), [defaultSorting, query])
	const queryString = React.useMemo(() => {
		if (!enabled) return null
		// On a hard load of this statically-optimized page, router.query is empty on the
		// first render and hydrates a moment later — fetching before that would issue a
		// paramless request whose rows flash in the wrong order, then get replaced.
		if (!router.isReady) return null
		return buildYieldsTableQueryString({ query, pagination: requestedPagination, sorting, extraQuery })
	}, [enabled, extraQuery, query, requestedPagination, sorting, router.isReady])
	const defaultQueryString = React.useMemo(
		() =>
			buildYieldsTableQueryString({
				query: {},
				pagination: { pageIndex: 0, pageSize: DEFAULT_YIELDS_TABLE_PAGE_SIZE },
				sorting: defaultSorting,
				extraQuery
			}),
		[defaultSorting, extraQuery]
	)
	const seed =
		initialData && queryString === defaultQueryString
			? { initialData, initialDataUpdatedAt: initialDataUpdatedAt ?? 0 }
			: undefined
	const rowsQuery = useYieldsPaginatedTable<TRow>(endpoint, queryString, seed)
	// The seed renders during SSR/pre-hydration (the static HTML contains it, so
	// dropping it before the router resolves would be a hydration mismatch) and
	// for the default view. A URL known to carry filters must NOT show it - the
	// seeded rows don't match the URL - and neither must a failed fetch.
	const seedVisible = (!router.isReady || queryString === defaultQueryString) && !rowsQuery.isError
	const data = rowsQuery.data ?? (seedVisible ? initialData : undefined)
	const rows = data?.rows ?? []
	const total = data?.total ?? 0
	const medianApy = data?.medianApy ?? null
	const pagination = React.useMemo<PaginationState>(() => {
		if (!data) return requestedPagination
		return {
			pageIndex: Math.max(0, data.page - 1),
			pageSize: data.pageSize || requestedPagination.pageSize
		}
	}, [requestedPagination, data])

	const handlePaginationChange = React.useCallback(
		(nextPagination: PaginationState) => {
			void pushYieldsQuery(
				router,
				{
					page: nextPagination.pageIndex > 0 ? String(nextPagination.pageIndex + 1) : undefined,
					pageSize:
						nextPagination.pageSize === DEFAULT_YIELDS_TABLE_PAGE_SIZE ? undefined : String(nextPagination.pageSize)
				},
				{ resetPage: false }
			)
		},
		[router]
	)

	const handleSortingChange = React.useCallback(
		(nextSorting: SortingState) => {
			const sort = nextSorting[0]
			void pushYieldsQuery(router, {
				sortBy: sort?.id,
				sortDesc: sort ? String(sort.desc) : undefined
			})
		},
		[router]
	)

	const buildAllRowsQueryString = React.useCallback(
		() =>
			buildYieldsTableQueryString({
				query,
				pagination: { ...pagination, pageIndex: 0 },
				sorting,
				pageSize: 'all',
				extraQuery
			}),
		[extraQuery, pagination, query, sorting]
	)

	const tableProps: Omit<IYieldsTableProps<TRow>, 'data'> = {
		rowCount: total,
		manualPagination: true,
		manualSorting: true,
		paginationState: pagination,
		sortingState: sorting,
		onPaginationChange: handlePaginationChange,
		onSortingChange: handleSortingChange,
		interactionDisabled: rowsQuery.isFetching
	}

	return {
		query,
		rows,
		total,
		medianApy,
		rowsQuery,
		tableProps,
		buildAllRowsQueryString
	}
}

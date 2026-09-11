import type { PaginationState, SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { useIsClient } from '~/hooks/useIsClient'
import { useYieldsPaginatedTable, type YieldsTableSeed } from './queries.client'
import { pushYieldsQuery } from './queryUpdates.client'
import { TABLE_PAGE_SIZE_PREF, writeStickyPref } from './stickyQueryPrefs'
import type { IYieldsTableProps } from './Tables/types'
import {
	buildYieldsTableQueryString,
	DEFAULT_YIELDS_TABLE_PAGE_SIZE,
	getYieldsTablePaginationFromQuery,
	getYieldsTableSortingFromQuery
} from './yieldsTableQuery'

type QueryRecord = Record<string, string | Array<string> | undefined>

type YieldsServerTableOptions<TRow> = {
	endpoint: string
	enabled?: boolean
	extraQuery?: QueryRecord
	defaultSorting?: SortingState
	/** ISR-provided first page of the DEFAULT view; ignored for parameterized URLs. */
	initialSeed?: YieldsTableSeed<TRow>
}

export function useYieldsServerTable<TRow>(options: YieldsServerTableOptions<TRow>) {
	const { endpoint, enabled = true, extraQuery, defaultSorting = [] } = options
	const router = useRouter()
	// router.isReady can be true during hydration; also wait for the client snapshot.
	const isClient = useIsClient()
	const ready = router.isReady && isClient
	const query = router.query as QueryRecord
	const requestedPagination = React.useMemo(() => getYieldsTablePaginationFromQuery(query), [query])
	const sorting = React.useMemo(() => getYieldsTableSortingFromQuery(query, defaultSorting), [defaultSorting, query])
	const queryString = React.useMemo(() => {
		if (!enabled || !ready) return null
		return buildYieldsTableQueryString({
			query,
			pagination: requestedPagination,
			sorting,
			...(extraQuery === undefined ? {} : { extraQuery })
		})
	}, [enabled, extraQuery, query, requestedPagination, sorting, ready])
	const defaultQueryString = React.useMemo(
		() =>
			buildYieldsTableQueryString({
				query: {},
				pagination: { pageIndex: 0, pageSize: DEFAULT_YIELDS_TABLE_PAGE_SIZE },
				sorting: defaultSorting,
				...(extraQuery === undefined ? {} : { extraQuery })
			}),
		[defaultSorting, extraQuery]
	)
	const seed = options.initialSeed && queryString === defaultQueryString ? options.initialSeed : undefined
	const rowsQuery = useYieldsPaginatedTable<TRow>(endpoint, queryString, seed)
	// Preserve SSR content during hydration; reuse the seed only for the default query.
	const seedVisible = (!ready || queryString === defaultQueryString) && !rowsQuery.isError
	// Hide stale/default rows while preferences restore.
	const data = enabled ? (rowsQuery.data ?? (seedVisible ? options.initialSeed?.initialData : undefined)) : undefined
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
			const sizeChanged = nextPagination.pageSize !== pagination.pageSize
			const pageSize =
				nextPagination.pageSize === DEFAULT_YIELDS_TABLE_PAGE_SIZE ? undefined : String(nextPagination.pageSize)
			// Paging must preserve both the URL's row count and the stored preference.
			if (sizeChanged) writeStickyPref(TABLE_PAGE_SIZE_PREF, pageSize)
			void pushYieldsQuery(
				router,
				{
					page: nextPagination.pageIndex > 0 ? String(nextPagination.pageIndex + 1) : undefined,
					...(sizeChanged ? { pageSize } : {})
				},
				{ resetPage: false }
			)
		},
		[router, pagination.pageSize]
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
				...(extraQuery === undefined ? {} : { extraQuery })
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
		isLoading: !enabled || (!data && !rowsQuery.isError),
		rowsQuery,
		tableProps,
		buildAllRowsQueryString
	}
}

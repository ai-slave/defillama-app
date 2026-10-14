import type { PaginationState, SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { useIsClient } from '~/hooks/useIsClient'
import { useYieldsPaginatedTable, type YieldsTableSeed } from './queries.client'
import { pushYieldsQuery } from './queryUpdates.client'
import { TABLE_PAGE_SIZE_PREF, writeStickyPref } from './stickyQueryPrefs'
import type { IYieldsTableProps } from './Tables/types'
import { useVerifiedAccess } from './useVerifiedAccess'
import {
	buildYieldsTableQueryString,
	DEFAULT_YIELDS_TABLE_PAGE_SIZE,
	getYieldsTablePaginationFromQuery,
	getYieldsTableSortingFromQuery
} from './yieldsTableQuery'

type QueryRecord = Record<string, string | Array<string> | undefined>

type YieldsServerTableOptions<TRow> = {
	endpoint: string
	/** Subscriber mirror of `endpoint`, for surfaces with paid columns (earn only, today). */
	privateEndpoint?: string
	enabled?: boolean
	extraQuery?: QueryRecord
	defaultSorting?: SortingState
	/** ISR-provided first page of the DEFAULT view; ignored for parameterized URLs. */
	initialSeed?: YieldsTableSeed<TRow>
}

export function useYieldsServerTable<TRow>(options: YieldsServerTableOptions<TRow>) {
	const { endpoint, privateEndpoint, enabled = true, extraQuery, defaultSorting = [] } = options
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
	const rowsQuery = useYieldsPaginatedTable<TRow>(endpoint, queryString, seed, privateEndpoint)
	const { isDenied } = useVerifiedAccess()
	// The server chose the seed's tier for this reader, so it is trusted through hydration. Once the
	// client CONFIRMS the reader is not paid, a paid seed goes: verified rows must not outlive access.
	// `userLoading` is not a denial and must not cause a locked flash or a speculative public fetch.
	const seedTierOk = !((options.initialSeed?.verifiedAccess ?? false) && isDenied)
	// The seed renders during SSR/pre-hydration (the HTML contains it, so dropping it before the
	// router resolves would be a hydration mismatch) and for the default view. A URL known to carry
	// filters must NOT show it - the seeded rows don't match the URL - and neither must a failed fetch.
	const seedVisible = (!ready || queryString === defaultQueryString) && !rowsQuery.isError && seedTierOk
	// `enabled` is false only while a saved preference or a legacy rewrite still has a replace
	// pending. A canonical server render has no replace target, so the gate is open and this seed
	// is the document. Dropping it whenever `enabled` is false would strip the pool table from
	// the HTML again, including on the canonical URL.
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
		// Whenever the rows on screen may not be the ones requested: the previous filters' page kept as a
		// placeholder, or a stale cached page being refreshed. Only the seed's own background refresh on
		// mount stays quiet, since those rows already match the server render.
		interactionDisabled: rowsQuery.isFetching && (rowsQuery.isPlaceholderData || seed === undefined)
	}

	return {
		query,
		data,
		rows,
		total,
		medianApy,
		isLoading: !enabled || (!data && !rowsQuery.isError),
		rowsQuery,
		tableProps,
		buildAllRowsQueryString
	}
}

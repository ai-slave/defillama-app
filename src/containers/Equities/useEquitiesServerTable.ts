import { functionalUpdate, type PaginationState, type SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { useEquitiesPaginatedTable } from './queries.client'
import {
	buildEquitiesTableQueryString,
	DEFAULT_EQUITIES_TABLE_PAGE_SIZE,
	EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
	getEquitiesTablePaginationFromQuery,
	getEquitiesTableSortingFromQuery,
	isSortingEqual
} from './tableQuery'
import type { EquitiesTableResponse } from './types'

type QueryRecord = Record<string, string | Array<string> | undefined>

const EMPTY_RESPONSE: EquitiesTableResponse = {
	schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
	rows: [],
	page: 1,
	pageSize: DEFAULT_EQUITIES_TABLE_PAGE_SIZE,
	total: 0,
	totalPages: 1,
	hasMore: false,
	options: { country: [], sector: [], industry: [] },
	updatedAt: null
}

export function useEquitiesServerTable({
	initialData,
	initialDataGeneratedAt,
	presetSorting,
	enabled
}: {
	initialData: EquitiesTableResponse
	initialDataGeneratedAt: number
	/** Sort implied by the active rank-by preset when the URL carries no explicit sort. */
	presetSorting: SortingState
	enabled: boolean
}) {
	const router = useRouter()
	const query = router.query as QueryRecord
	const requestedPagination = React.useMemo(() => getEquitiesTablePaginationFromQuery(query), [query])
	const sorting = React.useMemo(() => getEquitiesTableSortingFromQuery(query, presetSorting), [presetSorting, query])
	// Static page: router.query is empty until hydration, and fetching before that would request the
	// default view for a URL that carries filters. Chart views skip the row fetch entirely.
	const queryString = React.useMemo(
		() =>
			enabled && router.isReady
				? buildEquitiesTableQueryString({ query, pagination: requestedPagination, sorting })
				: null,
		[enabled, query, requestedPagination, router.isReady, sorting]
	)
	// A stale ISR page can carry an older response shape; only a current-schema seed is trusted.
	const seedIsCurrent = initialData.schemaVersion === EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION
	const seed =
		seedIsCurrent && queryString === '' ? { initialData, initialDataUpdatedAt: initialDataGeneratedAt } : undefined
	const rowsQuery = useEquitiesPaginatedTable(queryString, seed)
	const seedVisible = seedIsCurrent && (!router.isReady || queryString === '') && !rowsQuery.isError
	const data = rowsQuery.data ?? (seedVisible ? initialData : undefined)
	const fallback = seedIsCurrent ? initialData : EMPTY_RESPONSE
	const pagination = React.useMemo<PaginationState>(
		() => (data ? { pageIndex: Math.max(0, data.page - 1), pageSize: data.pageSize } : requestedPagination),
		[data, requestedPagination]
	)

	const onPaginationChange = React.useCallback(
		(updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
			const next = functionalUpdate(updater, pagination)
			void pushShallowQuery(router, {
				page: next.pageIndex > 0 ? String(next.pageIndex + 1) : undefined,
				pageSize: next.pageSize === DEFAULT_EQUITIES_TABLE_PAGE_SIZE ? undefined : String(next.pageSize)
			})
		},
		[pagination, router]
	)

	const onSortingChange = React.useCallback(
		(updater: SortingState | ((old: SortingState) => SortingState)) => {
			const next = functionalUpdate(updater, sorting)
			const sort = next[0]
			const isPresetSort = sort == null || isSortingEqual(next, presetSorting)
			void pushShallowQuery(router, {
				sortBy: isPresetSort ? undefined : sort.id,
				sortDesc: isPresetSort || sort.desc ? undefined : 'false',
				page: undefined
			})
		},
		[presetSorting, router, sorting]
	)

	const updateSearch = React.useCallback(
		(search: string) => {
			React.startTransition(() => {
				void pushShallowQuery(router, { search: search || undefined, page: undefined })
			})
		},
		[router]
	)

	return {
		query,
		search: readSingleQueryValue(query.search)?.trim() ?? '',
		rows: data?.rows ?? [],
		total: data?.total ?? 0,
		options: data?.options ?? fallback.options,
		updatedAt: data?.updatedAt ?? fallback.updatedAt,
		rowsQuery,
		pagination,
		sorting,
		onPaginationChange,
		onSortingChange,
		updateSearch
	}
}

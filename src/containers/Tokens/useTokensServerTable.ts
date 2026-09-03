import { functionalUpdate, type PaginationState, type SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { pushShallowQuery } from '~/utils/routerQuery'
import { useTokensPaginatedTable } from './queries.client'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensPageResponse } from './types'
import {
	buildTokensTableQueryString,
	DEFAULT_TOKENS_TABLE_PAGE_SIZE,
	getTokensPageQuery,
	getTokensTablePaginationFromQuery,
	getTokensTableSortingFromQuery
} from './utils'

type QueryRecord = Record<string, string | string[] | undefined>

const EMPTY_TOKENS_PAGE_RESPONSE: TokensPageResponse = {
	schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
	rows: [],
	total: 0,
	page: 1,
	pageSize: DEFAULT_TOKENS_TABLE_PAGE_SIZE,
	hasMore: false,
	stats: {
		totalMarketCap: 0,
		marketCapWeightedChange24h: null,
		spotVolume24h: 0,
		perpsVolume24h: 0,
		openInterest24h: 0,
		unlock30dUsd: 0,
		upcomingUnlockUsd: 0
	},
	statsDisplay: {
		totalMarketCap: '$0',
		marketCapWeightedChange24h: null,
		marketCapWeightedChange24hTone: 'neutral',
		spotVolume24h: '$0',
		perpsVolume24h: '$0',
		openInterest24h: '$0',
		unlock30dUsd: '$0',
		upcomingUnlockUsd: '$0'
	},
	updatedAt: null,
	chainOptions: [],
	categoryOptions: []
}

export function useTokensServerTable(initialData: TokensPageResponse, enabled = true) {
	const router = useRouter()
	const query = router.query as QueryRecord
	const requestedPagination = React.useMemo(() => getTokensTablePaginationFromQuery(query), [query])
	const sorting = React.useMemo(() => getTokensTableSortingFromQuery(query), [query])
	const pageQuery = React.useMemo(() => getTokensPageQuery(query), [query])
	// Chart views skip the row fetch; options and stats fall back to the SSR snapshot, which carries them all.
	const queryString = React.useMemo(
		() => (enabled ? buildTokensTableQueryString({ query, pagination: requestedPagination, sorting }) : null),
		[enabled, query, requestedPagination, sorting]
	)
	const rowsQuery = useTokensPaginatedTable(queryString, initialData)
	const fallbackData =
		initialData.schemaVersion === TOKENS_PAGE_RESPONSE_SCHEMA_VERSION ? initialData : EMPTY_TOKENS_PAGE_RESPONSE
	const data = rowsQuery.data?.schemaVersion === TOKENS_PAGE_RESPONSE_SCHEMA_VERSION ? rowsQuery.data : fallbackData
	const pagination = React.useMemo<PaginationState>(
		() => ({
			pageIndex: Math.max(0, data.page - 1),
			pageSize: data.pageSize || requestedPagination.pageSize
		}),
		[data.page, data.pageSize, requestedPagination.pageSize]
	)

	const handlePaginationChange = React.useCallback(
		(updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
			const nextPagination = functionalUpdate(updater, pagination)
			void pushShallowQuery(router, {
				page: nextPagination.pageIndex > 0 ? String(nextPagination.pageIndex + 1) : undefined,
				pageSize:
					nextPagination.pageSize === DEFAULT_TOKENS_TABLE_PAGE_SIZE ? undefined : String(nextPagination.pageSize),
				category: undefined
			})
		},
		[pagination, router]
	)

	const handleSortingChange = React.useCallback(
		(updater: SortingState | ((old: SortingState) => SortingState)) => {
			const nextSorting = functionalUpdate(updater, sorting)
			const sort = nextSorting[0]
			void pushShallowQuery(router, {
				sortBy: sort?.id === 'marketCap' ? undefined : sort?.id,
				sortDesc: sort?.desc === false ? 'false' : undefined,
				page: undefined,
				category: undefined
			})
		},
		[router, sorting]
	)

	const updateSearch = React.useCallback(
		(search: string) => {
			React.startTransition(() => {
				void pushShallowQuery(router, { search: search || undefined, page: undefined, category: undefined })
			})
		},
		[router]
	)

	return {
		query,
		pageQuery,
		data,
		rows: data.rows,
		total: data.total,
		rowsQuery,
		pagination,
		sorting,
		onPaginationChange: handlePaginationChange,
		onSortingChange: handleSortingChange,
		updateSearch
	}
}

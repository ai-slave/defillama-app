import type { ParsedUrlQuery } from 'node:querystring'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import { parseNumberQueryParam, readSingleQueryValue, toQueryString } from '~/utils/routerQuery'
import type { IEquitiesCompanyApiItem } from './api.types'
import {
	EQUITY_FILTERS_QUERY_KEY,
	parseEquityFiltersQuery,
	serializeEquityFiltersQuery,
	type EquityActiveFilter
} from './filters'
import { EQUITIES_TREEMAP_SIZE_METRICS, type EquitiesTreemapSizeMetric } from './treemapData'

export const EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION = 1
export const DEFAULT_EQUITIES_TABLE_PAGE_SIZE = 50
export const MAX_EQUITIES_TABLE_PAGE_SIZE = 500

export const EQUITIES_SORT_KEYS = [
	'marketCap',
	'currentPrice',
	'fiftyTwoWeekHigh',
	'fiftyTwoWeekLow',
	'priceChangePercentage1d',
	'priceChangePercentage7d',
	'priceChangePercentage1m',
	'volume',
	'marketCapChange1d',
	'circulatingMarketCap',
	'enterpriseValue',
	'trailingPE',
	'priceToRevenue',
	'dividendYield',
	'holdersYield',
	'priceToBook',
	'enterpriseValueToEbitda',
	'operatingProfitMarginTTM',
	'revenueTTM',
	'grossProfitTTM',
	'earningsTTM',
	'ebitdaTTM',
	'holdersRevenueTTM',
	'holderEarningsTTM',
	'dividendsTTM',
	'stockRepurchaseTTM',
	'stockIssuanceTTM',
	'stockBasedCompensationTTM',
	'cashAndCashEquivalents',
	'totalAssets',
	'totalLiabilities',
	'totalShareholdersEquity',
	'totalDebt',
	'circulatingSupply',
	'totalSupply',
	'employeeCount'
] as const satisfies ReadonlyArray<keyof IEquitiesCompanyApiItem>

export type EquitiesSortKey = (typeof EQUITIES_SORT_KEYS)[number]

const EQUITIES_SORT_KEY_SET = new Set<string>(EQUITIES_SORT_KEYS)
const DEFAULT_SORT_KEY: EquitiesSortKey = 'marketCap'
export const EQUITIES_DEFAULT_SORTING: SortingState = [{ id: DEFAULT_SORT_KEY, desc: true }]

type QueryRecord = Record<string, string | Array<string> | undefined>

export interface EquitiesTableQuery {
	page: number
	pageSize: number
	sortBy: EquitiesSortKey
	sortDesc: boolean
	search: string
	filters: Array<EquityActiveFilter>
}

function parsePositiveIntegerQueryParam(value: ParsedUrlQuery[string], fallback: number): number {
	const parsed = parseNumberQueryParam(value)
	return parsed != null && parsed > 0 ? Math.floor(parsed) : fallback
}

function parseSearch(query: ParsedUrlQuery): string {
	return readSingleQueryValue(query.search)?.trim() ?? ''
}

export function getEquitiesTableQuery(query: ParsedUrlQuery): EquitiesTableQuery {
	const rawSortBy = readSingleQueryValue(query.sortBy)
	return {
		page: parsePositiveIntegerQueryParam(query.page, 1),
		pageSize: Math.min(
			parsePositiveIntegerQueryParam(query.pageSize, DEFAULT_EQUITIES_TABLE_PAGE_SIZE),
			MAX_EQUITIES_TABLE_PAGE_SIZE
		),
		sortBy: rawSortBy && EQUITIES_SORT_KEY_SET.has(rawSortBy) ? (rawSortBy as EquitiesSortKey) : DEFAULT_SORT_KEY,
		sortDesc: readSingleQueryValue(query.sortDesc) !== 'false',
		search: parseSearch(query),
		filters: parseEquityFiltersQuery(query[EQUITY_FILTERS_QUERY_KEY])
	}
}

/** Everything that changes row order or membership; paging is excluded so every page shares one prepared set. */
export function getEquitiesTableQuerySignature(query: EquitiesTableQuery): string {
	return JSON.stringify({
		sortBy: query.sortBy,
		sortDesc: query.sortDesc,
		search: query.search.toLowerCase(),
		filters: serializeEquityFiltersQuery(query.filters) ?? ''
	})
}

export function getEquitiesTablePaginationFromQuery(query: ParsedUrlQuery): PaginationState {
	const pageQuery = getEquitiesTableQuery(query)
	return { pageIndex: pageQuery.page - 1, pageSize: pageQuery.pageSize }
}

/** An absent `sortBy` means the preset's sort, so the URL stays `?rankBy=earnings` until the reader sorts by hand. */
export function getEquitiesTableSortingFromQuery(query: ParsedUrlQuery, fallbackSorting: SortingState): SortingState {
	const sortBy = readSingleQueryValue(query.sortBy)
	if (!sortBy || !EQUITIES_SORT_KEY_SET.has(sortBy)) return fallbackSorting
	return [{ id: sortBy, desc: readSingleQueryValue(query.sortDesc) !== 'false' }]
}

export function isSortingEqual(left: SortingState, right: SortingState): boolean {
	if (left.length !== right.length) return false
	for (let index = 0; index < left.length; index++) {
		if (left[index].id !== right[index].id || left[index].desc !== right[index].desc) return false
	}
	return true
}

function getEquitiesFilterQueryParams(query: QueryRecord): Record<string, string | undefined> {
	return {
		search: parseSearch(query) || undefined,
		[EQUITY_FILTERS_QUERY_KEY]: serializeEquityFiltersQuery(parseEquityFiltersQuery(query[EQUITY_FILTERS_QUERY_KEY]))
	}
}

export function buildEquitiesTableQueryString({
	query,
	pagination,
	sorting
}: {
	query: QueryRecord
	pagination: PaginationState
	sorting: SortingState
}): string {
	const sort = sorting[0]
	const pageSize = Math.min(pagination.pageSize, MAX_EQUITIES_TABLE_PAGE_SIZE)
	const isDefaultSort = sort == null || isSortingEqual(sorting, EQUITIES_DEFAULT_SORTING)
	return toQueryString({
		page: pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
		pageSize: pageSize === DEFAULT_EQUITIES_TABLE_PAGE_SIZE ? undefined : String(pageSize),
		sortBy: isDefaultSort ? undefined : sort.id,
		sortDesc: isDefaultSort || sort.desc ? undefined : 'false',
		...getEquitiesFilterQueryParams(query)
	})
}

export function getEquitiesTreemapSizeMetricFromQuery(query: ParsedUrlQuery): EquitiesTreemapSizeMetric {
	const raw = readSingleQueryValue(query.sizeMetric)
	return raw && (EQUITIES_TREEMAP_SIZE_METRICS as ReadonlyArray<string>).includes(raw)
		? (raw as EquitiesTreemapSizeMetric)
		: 'marketCap'
}

/** Filters plus the size metric; the market map ranks server-side so sort and paging do not apply. */
export function buildEquitiesTreemapQueryString({
	query,
	sizeMetric
}: {
	query: QueryRecord
	sizeMetric: EquitiesTreemapSizeMetric
}): string {
	return toQueryString({
		...getEquitiesFilterQueryParams(query),
		sizeMetric: sizeMetric === 'marketCap' ? undefined : sizeMetric
	})
}

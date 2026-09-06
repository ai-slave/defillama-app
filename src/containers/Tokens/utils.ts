import type { ParsedUrlQuery } from 'node:querystring'
import type { PaginationState, SortingState } from '@tanstack/react-table'
import { formatPercent, formatPercentChange, formatUsd } from '~/utils/numberFormat'
import {
	isTrueQueryParam,
	parseNumberQueryParam,
	readSingleQueryValue,
	toNonEmptyArrayParam,
	toQueryString
} from '~/utils/routerQuery'
import {
	TOKENS_NUMERIC_FILTER_FIELDS,
	TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
	TOKENS_SORT_KEYS,
	type TokensFilterOption,
	type TokensNumericFilter,
	type TokensPageQuery,
	type TokensPageResponse,
	type TokensPageStats,
	type TokensPageStatsDisplay,
	type TokensSortIndex,
	type TokensSortIndexes,
	type TokensSourceRow,
	type TokensSortBy,
	type TokensTableRowDisplay,
	type TokensTableRow
} from './types'

export const DEFAULT_TOKENS_TABLE_PAGE_SIZE = 50
export const MAX_TOKENS_TABLE_PAGE_SIZE = 500

const DEFAULT_TOKENS_SORT_BY: TokensSortBy = 'marketCap'
const TOKENS_SORT_KEY_SET = new Set<TokensSortBy>(TOKENS_SORT_KEYS)

function parsePositiveIntegerQueryParam(value: ParsedUrlQuery[string], fallback: number): number {
	const parsed = parseNumberQueryParam(value)
	return parsed != null && parsed > 0 ? Math.floor(parsed) : fallback
}

function parseOptionalRankQueryParam(value: ParsedUrlQuery[string]): number | null {
	const parsed = parseNumberQueryParam(value)
	return parsed != null && parsed > 0 ? Math.floor(parsed) : null
}

export function parseTokenFilterValues(value: ParsedUrlQuery[string]): Array<string> | null {
	if (value == null) return null
	return toNonEmptyArrayParam(value)
}

export function resolveTokenFilterValues(
	includeValues: Array<string> | null,
	excludeValues: Array<string>,
	allValues: Array<string>
): Array<string> {
	const validValues = new Set(allValues)
	let selectedValues: Array<string>
	if (includeValues == null || includeValues.includes('All')) {
		selectedValues = allValues
	} else if (includeValues.includes('None')) {
		selectedValues = []
	} else {
		selectedValues = []
		const selected = new Set<string>()
		for (const value of includeValues) {
			if (validValues.has(value) && !selected.has(value)) {
				selected.add(value)
				selectedValues.push(value)
			}
		}
	}

	if (excludeValues.length === 0) return selectedValues
	const excluded = new Set(excludeValues)
	return selectedValues.filter((value) => !excluded.has(value))
}

function getTokenFilterSelection(
	includeValues: Array<string> | null,
	excludeValues: Array<string>,
	allValues: Array<string>
): Set<string> | null {
	const hasExplicitInclude = includeValues != null && !includeValues.includes('All')
	const selectedValues = resolveTokenFilterValues(includeValues, excludeValues, allValues)
	if ((!hasExplicitInclude || allValues.length > 0) && selectedValues.length === allValues.length) return null
	return new Set(selectedValues)
}

export function parseRankRangeQueryParams(query: ParsedUrlQuery): { rankFrom: number | null; rankTo: number | null } {
	let rankFrom = parseOptionalRankQueryParam(query.rankFrom)
	let rankTo = parseOptionalRankQueryParam(query.rankTo)
	if (rankFrom != null && rankTo != null && rankFrom > rankTo) [rankFrom, rankTo] = [rankTo, rankFrom]
	return { rankFrom, rankTo }
}

export function parseNumericFiltersQueryParams(query: ParsedUrlQuery): Array<TokensNumericFilter> {
	const filters: Array<TokensNumericFilter> = []
	for (const field of TOKENS_NUMERIC_FILTER_FIELDS) {
		let min = parseNumberQueryParam(query[`min_${field}`])
		let max = parseNumberQueryParam(query[`max_${field}`])
		if (min == null && max == null) continue
		if (min != null && max != null && min > max) [min, max] = [max, min]
		filters.push({ field, min, max })
	}
	return filters
}

export function getTokensPageQuery(query: ParsedUrlQuery): TokensPageQuery {
	const rawSortBy = readSingleQueryValue(query.sortBy)
	const pageSize = Math.min(
		parsePositiveIntegerQueryParam(query.pageSize, DEFAULT_TOKENS_TABLE_PAGE_SIZE),
		MAX_TOKENS_TABLE_PAGE_SIZE
	)
	const { rankFrom, rankTo } = parseRankRangeQueryParams(query)
	return {
		page: parsePositiveIntegerQueryParam(query.page, 1),
		pageSize,
		sortBy:
			rawSortBy && TOKENS_SORT_KEY_SET.has(rawSortBy as TokensSortBy)
				? (rawSortBy as TokensSortBy)
				: DEFAULT_TOKENS_SORT_BY,
		sortDesc: readSingleQueryValue(query.sortDesc) !== 'false',
		search: readSingleQueryValue(query.search)?.trim() ?? '',
		rankFrom,
		rankTo,
		numericFilters: parseNumericFiltersQueryParams(query),
		chains: parseTokenFilterValues(query.chains),
		excludeChains: parseTokenFilterValues(query.excludeChains) ?? [],
		nativeOnly: isTrueQueryParam(query.nativeOnly),
		categories: parseTokenFilterValues(query.categories),
		excludeCategories: parseTokenFilterValues(query.excludeCategories) ?? []
	}
}

export function getTokensTablePaginationFromQuery(query: ParsedUrlQuery): PaginationState {
	const pageQuery = getTokensPageQuery(query)
	return {
		pageIndex: pageQuery.page - 1,
		pageSize: pageQuery.pageSize
	}
}

export function getTokensTableSortingFromQuery(query: ParsedUrlQuery): SortingState {
	const pageQuery = getTokensPageQuery(query)
	return [{ id: pageQuery.sortBy, desc: pageQuery.sortDesc }]
}

function getTokensFilterQueryParams(pageQuery: TokensPageQuery): Record<string, string | Array<string> | undefined> {
	const params: Record<string, string | Array<string> | undefined> = {
		search: pageQuery.search || undefined,
		rankFrom: pageQuery.rankFrom != null ? String(pageQuery.rankFrom) : undefined,
		rankTo: pageQuery.rankTo != null ? String(pageQuery.rankTo) : undefined,
		chains: pageQuery.chains ?? undefined,
		excludeChains: pageQuery.excludeChains.length > 0 ? pageQuery.excludeChains : undefined,
		nativeOnly: pageQuery.nativeOnly ? 'true' : undefined,
		categories: pageQuery.categories ?? undefined,
		excludeCategories: pageQuery.excludeCategories.length > 0 ? pageQuery.excludeCategories : undefined
	}
	for (const filter of pageQuery.numericFilters) {
		if (filter.min != null) params[`min_${filter.field}`] = String(filter.min)
		if (filter.max != null) params[`max_${filter.field}`] = String(filter.max)
	}
	return params
}

export function buildTokensTableQueryString({
	query,
	pagination,
	sorting
}: {
	query: Record<string, string | Array<string> | undefined>
	pagination: PaginationState
	sorting: SortingState
}) {
	const sort = sorting[0]
	const pageSize = Math.min(pagination.pageSize, MAX_TOKENS_TABLE_PAGE_SIZE)
	const pageQuery = getTokensPageQuery(query)
	return toQueryString({
		page: pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
		pageSize: pageSize === DEFAULT_TOKENS_TABLE_PAGE_SIZE ? undefined : String(pageSize),
		sortBy: sort?.id === DEFAULT_TOKENS_SORT_BY ? undefined : sort?.id,
		sortDesc: sort ? (sort.desc ? undefined : 'false') : undefined,
		...getTokensFilterQueryParams(pageQuery)
	})
}

/** Filter-only query string shared by the market map and movers views; sort and paging do not apply there. */
export function buildTokensChartQueryString(query: Record<string, string | Array<string> | undefined>): string {
	return toQueryString(getTokensFilterQueryParams(getTokensPageQuery(query)))
}

function compareString(a: string, b: string): number {
	if (a < b) return -1
	if (a > b) return 1
	return 0
}

function compareTokenRowsAsc(a: TokensSourceRow, b: TokensSourceRow, sortBy: TokensSortBy): number {
	if (sortBy === 'name') return compareString(a.name, b.name) || compareString(a.id, b.id)

	const aValue = a[sortBy]
	const bValue = b[sortBy]
	if (aValue == null && bValue == null) return compareString(a.id, b.id)
	if (aValue == null) return 1
	if (bValue == null) return -1

	return aValue - bValue || compareString(a.id, b.id)
}

function getNullStart(rows: Array<TokensSourceRow>, sortBy: TokensSortBy): number {
	if (sortBy === 'name') return rows.length
	for (let i = 0; i < rows.length; i++) {
		if (rows[i]![sortBy] == null) return i
	}
	return rows.length
}

export function buildTokensSortIndexes(rows: Array<TokensSourceRow>): TokensSortIndexes {
	const indexes = {} as TokensSortIndexes
	for (const sortBy of TOKENS_SORT_KEYS) {
		const sortedRows = rows.slice()
		sortedRows.sort((a, b) => compareTokenRowsAsc(a, b, sortBy))
		indexes[sortBy] = { rows: sortedRows, sortBy, nullStart: getNullStart(sortedRows, sortBy) }
	}
	return indexes
}

function currencyDisplay(value: number | null): string | null {
	return value == null ? null : formatUsd(value, { compact: true })
}

function priceDisplay(value: number | null): string | null {
	if (value == null) return null
	const absoluteValue = Math.abs(value)
	const maximumFractionDigits =
		absoluteValue >= 1
			? 2
			: absoluteValue >= 0.01 || absoluteValue === 0
				? 4
				: Math.min(20, Math.floor(-Math.log10(absoluteValue)) + 4)
	return formatUsd(value, { maximumFractionDigits })
}

function percentDisplay(value: number | null, signed = false): string | null {
	if (value == null) return null
	return signed ? formatPercentChange(value) : formatPercent(value, { input: 'percent' })
}

function percentTone(value: number | null): 'positive' | 'negative' | 'neutral' {
	if (value == null || value === 0) return 'neutral'
	return value > 0 ? 'positive' : 'negative'
}

function percentWidth(value: number | null): string | null {
	if (value == null) return null
	return `${Math.max(0, Math.min(100, value))}%`
}

function getRowDisplay(row: TokensSourceRow): TokensTableRowDisplay {
	return {
		price: priceDisplay(row.price),
		priceChange24h: percentDisplay(row.priceChange24h, true),
		priceChange24hTone: percentTone(row.priceChange24h),
		priceChange7d: percentDisplay(row.priceChange7d, true),
		priceChange7dTone: percentTone(row.priceChange7d),
		priceChange30d: percentDisplay(row.priceChange30d, true),
		priceChange30dTone: percentTone(row.priceChange30d),
		marketCap: currencyDisplay(row.marketCap),
		fdv: currencyDisplay(row.fdv),
		outstandingFdv: currencyDisplay(row.outstandingFdv),
		unlockedPercent: percentDisplay(row.unlockedPercent),
		unlockedPercentWidth: percentWidth(row.unlockedPercent),
		spotVolume24h: currencyDisplay(row.spotVolume24h),
		perpsVolume24h: currencyDisplay(row.perpsVolume24h),
		openInterest24h: currencyDisplay(row.openInterest24h),
		fees24h: currencyDisplay(row.fees24h),
		revenue24h: currencyDisplay(row.revenue24h),
		holdersRevenue24h: currencyDisplay(row.holdersRevenue24h),
		trsPercent: percentDisplay(row.trsPercent),
		trsPercentWidth: percentWidth(row.trsPercent),
		unlock30dUsd: currencyDisplay(row.unlock30dUsd),
		upcomingUnlockUsd: currencyDisplay(row.upcomingUnlockUsd)
	}
}

function toTableRow(row: TokensSourceRow, rowNumber: number): TokensTableRow {
	const {
		searchKey: _searchKey,
		chains: _chains,
		primaryChain: _primaryChain,
		categories: _categories,
		...tableRow
	} = row
	return { ...tableRow, rowNumber, display: getRowDisplay(row) }
}

export function getTokensStatsDisplay(stats: TokensPageStats): TokensPageStatsDisplay {
	return {
		totalMarketCap: formatUsd(stats.totalMarketCap, { compact: true }),
		marketCapWeightedChange24h: percentDisplay(stats.marketCapWeightedChange24h, true),
		marketCapWeightedChange24hTone: percentTone(stats.marketCapWeightedChange24h),
		spotVolume24h: currencyDisplay(stats.spotVolume24h),
		perpsVolume24h: currencyDisplay(stats.perpsVolume24h),
		openInterest24h: currencyDisplay(stats.openInterest24h),
		unlock30dUsd: currencyDisplay(stats.unlock30dUsd),
		upcomingUnlockUsd: currencyDisplay(stats.upcomingUnlockUsd)
	}
}

export interface TokensRowFilter {
	search: string
	requestedIds: Set<string> | null
	rankFrom: number | null
	rankTo: number | null
	numericFilters: Array<TokensNumericFilter>
	chains: Set<string> | null
	nativeOnly: boolean
	categories: Set<string> | null
}

export function matchesTokensRowFilter(row: TokensSourceRow, filter: TokensRowFilter): boolean {
	if (filter.requestedIds != null && !filter.requestedIds.has(row.id.toLowerCase())) return false
	if (filter.rankFrom != null || filter.rankTo != null) {
		if (row.rank == null) return false
		if (filter.rankFrom != null && row.rank < filter.rankFrom) return false
		if (filter.rankTo != null && row.rank > filter.rankTo) return false
	}
	for (const numericFilter of filter.numericFilters) {
		const value = row[numericFilter.field]
		if (value == null) return false
		if (numericFilter.min != null && value < numericFilter.min) return false
		if (numericFilter.max != null && value > numericFilter.max) return false
	}
	const chains = filter.chains
	if (chains != null) {
		if (filter.nativeOnly) {
			if (row.primaryChain == null || !chains.has(row.primaryChain)) return false
		} else if (!row.chains.some((chain) => chains.has(chain))) return false
	}
	const categories = filter.categories
	if (categories != null && !row.categories.some((category) => categories.has(category))) return false
	return filter.search === '' || row.searchKey.includes(filter.search)
}

function countMatchingRows(rows: Array<TokensSourceRow>, filter: TokensRowFilter): number {
	let total = 0
	for (const row of rows) {
		if (matchesTokensRowFilter(row, filter)) total++
	}
	return total
}

function collectSortedRows(
	sortedRows: Array<TokensSourceRow>,
	filter: TokensRowFilter,
	start: number,
	end: number,
	pageRows: Array<TokensTableRow>
): void {
	let matched = 0
	for (const row of sortedRows) {
		if (!matchesTokensRowFilter(row, filter)) continue
		if (matched >= start) pageRows.push(toTableRow(row, matched + 1))
		matched++
		if (matched >= end) return
	}
}

function hasSameSortValue(a: TokensSourceRow, b: TokensSourceRow, sortBy: TokensSortBy): boolean {
	return sortBy === 'name' ? a.name === b.name : a[sortBy] === b[sortBy]
}

function collectDescendingRows(
	index: TokensSortIndex,
	filter: TokensRowFilter,
	start: number,
	end: number,
	pageRows: Array<TokensTableRow>
): void {
	let matched = 0
	let i = index.nullStart - 1

	while (i >= 0) {
		let groupStart = i
		// All indices are bounded by the same immutable sort array.
		while (groupStart > 0 && hasSameSortValue(index.rows[groupStart - 1]!, index.rows[i]!, index.sortBy)) {
			groupStart--
		}

		for (let j = groupStart; j <= i; j++) {
			const row = index.rows[j]!
			if (!matchesTokensRowFilter(row, filter)) continue
			if (matched >= start) pageRows.push(toTableRow(row, matched + 1))
			matched++
			if (matched >= end) return
		}

		i = groupStart - 1
	}

	for (let j = index.nullStart; j < index.rows.length; j++) {
		const row = index.rows[j]!
		if (!matchesTokensRowFilter(row, filter)) continue
		if (matched >= start) pageRows.push(toTableRow(row, matched + 1))
		matched++
		if (matched >= end) return
	}
}

function collectPageRows(
	index: TokensSortIndex,
	sortDesc: boolean,
	filter: TokensRowFilter,
	start: number,
	end: number
): Array<TokensTableRow> {
	const pageRows: Array<TokensTableRow> = []
	if (sortDesc) {
		collectDescendingRows(index, filter, start, end, pageRows)
	} else {
		collectSortedRows(index.rows, filter, start, end, pageRows)
	}
	return pageRows
}

function parseRequestedIds(value: ParsedUrlQuery[string]): Set<string> | null {
	// Absent param => no id filter. A present param (even if it parses to nothing) filters to its set,
	// so a malformed/empty `ids=` matches nothing rather than leaking the full token list.
	if (value == null) return null
	const raw = Array.isArray(value) ? value.join(',') : value
	const ids = raw
		.split(',')
		.map((id) => id.trim().toLowerCase())
		.filter(Boolean)
	return new Set(ids)
}

export function buildTokensRowFilter(
	query: ParsedUrlQuery,
	chainOptions: Array<TokensFilterOption>,
	categoryOptions: Array<TokensFilterOption>
): TokensRowFilter {
	const pageQuery = getTokensPageQuery(query)
	const chains = getTokenFilterSelection(
		pageQuery.chains,
		pageQuery.excludeChains,
		chainOptions.map((option) => option.id)
	)
	return {
		search: pageQuery.search.toLowerCase(),
		requestedIds: parseRequestedIds(query.ids),
		rankFrom: pageQuery.rankFrom,
		rankTo: pageQuery.rankTo,
		numericFilters: pageQuery.numericFilters,
		chains,
		nativeOnly: pageQuery.nativeOnly && chains != null,
		categories: getTokenFilterSelection(
			pageQuery.categories,
			pageQuery.excludeCategories,
			categoryOptions.map((option) => option.id)
		)
	}
}

export function getTokensPageFromRows(
	rows: Array<TokensSourceRow>,
	sortIndexes: TokensSortIndexes,
	query: ParsedUrlQuery,
	base: Omit<TokensPageResponse, 'schemaVersion' | 'rows' | 'total' | 'page' | 'pageSize' | 'hasMore' | 'statsDisplay'>
): TokensPageResponse {
	const pageQuery = getTokensPageQuery(query)
	const filter = buildTokensRowFilter(query, base.chainOptions, base.categoryOptions)
	const hasFilter =
		filter.search !== '' ||
		filter.requestedIds != null ||
		filter.rankFrom != null ||
		filter.rankTo != null ||
		filter.numericFilters.length > 0 ||
		filter.chains != null ||
		filter.categories != null
	const total = hasFilter ? countMatchingRows(rows, filter) : rows.length
	const pageCount = Math.max(1, Math.ceil(total / pageQuery.pageSize))
	const page = Math.min(pageQuery.page, pageCount)
	const start = (page - 1) * pageQuery.pageSize
	const end = start + pageQuery.pageSize

	return {
		...base,
		schemaVersion: TOKENS_PAGE_RESPONSE_SCHEMA_VERSION,
		rows: collectPageRows(sortIndexes[pageQuery.sortBy], pageQuery.sortDesc, filter, start, end),
		total,
		page,
		pageSize: pageQuery.pageSize,
		hasMore: end < total,
		statsDisplay: getTokensStatsDisplay(base.stats)
	}
}

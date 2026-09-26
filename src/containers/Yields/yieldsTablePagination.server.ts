import type { ParsedUrlQuery } from 'node:querystring'
import { offsetTablePage } from '~/server/tablePages/offsetPage.server'
import { prepareTableRows } from '~/server/tablePages/preparedRows.server'
import { canonicalQuerySignature } from '~/server/tablePages/tableQuery'
import type { YieldsSnapshot } from './data/snapshot'
import {
	DEFAULT_YIELDS_TABLE_PAGE_SIZE,
	MAX_YIELDS_TABLE_PAGE_SIZE,
	YIELDS_PAGING_PARAMS,
	type YieldsPaginatedTableResponse
} from './yieldsTableQuery'

/**
 * Memoize a yields table preparation per (generation, filters+sort): the
 * signature covers every wire param except paging, so each page of one
 * combination reuses one prepared payload.
 */
export function prepareYieldsTable<Prepared>({
	surface,
	snapshot,
	query,
	prepare,
	measureBytes,
	maxBytes = 64 * 1024 * 1024
}: {
	surface: string
	snapshot: YieldsSnapshot
	query: ParsedUrlQuery
	prepare: () => Prepared | Promise<Prepared>
	measureBytes: (prepared: Prepared) => number
	maxBytes?: number
}): Promise<Prepared> {
	return prepareTableRows({
		namespace: `table-pages:yields-${surface}:prepared-rows`,
		domain: surface,
		version: snapshot.generationId,
		signature: canonicalQuerySignature(query as Record<string, string | Array<string> | undefined>, {
			exclude: YIELDS_PAGING_PARAMS
		}),
		memory: { ttlMs: 10 * 60 * 1000, maxEntries: 8, maxBytes },
		prepare,
		measureBytes
	})
}

const ALL_PAGE_SIZE = 'all'

export type YieldsTableSort<SortKey extends string = string> = {
	sortBy: SortKey
	sortDesc: boolean
}

type SortAccessor<TRow> = (row: TRow) => unknown

export type YieldsTableSortAccessors<TRow, SortKey extends string> = Partial<Record<SortKey, SortAccessor<TRow>>>

function getFirstQueryValue(value: ParsedUrlQuery[string]): string | undefined {
	return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined
}

function parsePage(query: ParsedUrlQuery): number {
	const page = Number(getFirstQueryValue(query.page))
	return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function parsePageSize(query: ParsedUrlQuery, total: number): number {
	const rawPageSize = getFirstQueryValue(query.pageSize)
	if (rawPageSize === ALL_PAGE_SIZE) return total

	const pageSize = Number(rawPageSize)
	return Number.isFinite(pageSize) && pageSize > 0
		? Math.min(Math.floor(pageSize), MAX_YIELDS_TABLE_PAGE_SIZE)
		: DEFAULT_YIELDS_TABLE_PAGE_SIZE
}

export function parseYieldsSort<SortKey extends string>(
	query: ParsedUrlQuery,
	defaultSort?: YieldsTableSort<SortKey>
): YieldsTableSort<SortKey> | null {
	const sortBy = getFirstQueryValue(query.sortBy) as SortKey | undefined
	if (!sortBy) return defaultSort ?? null

	return {
		sortBy,
		sortDesc: getFirstQueryValue(query.sortDesc) !== 'false'
	}
}

function firstSortableValue(value: unknown): unknown {
	return Array.isArray(value) ? value[0] : value
}

function numericValue(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (!trimmed) return null
	const parsed = Number(trimmed)
	return Number.isFinite(parsed) ? parsed : null
}

export function compareYieldsTableValues(left: unknown, right: unknown): number {
	const leftValue = firstSortableValue(left)
	const rightValue = firstSortableValue(right)
	const leftNumber = numericValue(leftValue)
	const rightNumber = numericValue(rightValue)

	if (leftNumber != null && rightNumber != null) {
		return leftNumber - rightNumber
	}
	if (leftNumber != null) return -1
	if (rightNumber != null) return 1

	return String(leftValue).localeCompare(String(rightValue))
}

/** Sort rows for a parsed yields sort: missing values last, stable within ties. */
export function sortYieldsRows<TRow, SortKey extends string>({
	rows,
	query,
	sortAccessors,
	defaultSort,
	fallbackSortAccessor
}: {
	rows: Array<TRow>
	query: ParsedUrlQuery
	sortAccessors?: YieldsTableSortAccessors<TRow, SortKey>
	defaultSort?: YieldsTableSort<SortKey>
	fallbackSortAccessor?: (row: TRow, sortBy: string) => unknown
}): Array<TRow> {
	const parsedSort = parseYieldsSort(query, defaultSort)
	const hasParsedSortAccessor =
		parsedSort != null && (sortAccessors?.[parsedSort.sortBy] != null || fallbackSortAccessor != null)
	const sort = hasParsedSortAccessor ? parsedSort : defaultSort
	const accessor =
		sort &&
		(sortAccessors?.[sort.sortBy] ??
			(fallbackSortAccessor ? (row: TRow) => fallbackSortAccessor(row, sort.sortBy) : null))
	if (!accessor) return rows

	return rows.slice().sort((left, right) => {
		const leftValue = accessor(left)
		const rightValue = accessor(right)
		const leftMissing = leftValue == null
		const rightMissing = rightValue == null
		if (leftMissing && rightMissing) return 0
		if (leftMissing) return 1
		if (rightMissing) return -1

		const result = compareYieldsTableValues(leftValue, rightValue)
		if (result === 0) return 0
		return sort.sortDesc ? -result : result
	})
}

/**
 * Slice one page from an already-sorted row set. Page requests past the end
 * clamp to the last page (public contract), and `pageSize=all` returns the
 * complete set.
 */
export function sliceYieldsPage<TRow>(
	sortedRows: Array<TRow>,
	query: ParsedUrlQuery
): Omit<YieldsPaginatedTableResponse<TRow>, 'medianApy'> {
	const total = sortedRows.length
	const rawPageSize = getFirstQueryValue(query.pageSize)
	const pageSize = parsePageSize(query, total)
	const maxPage = total > 0 && pageSize > 0 ? Math.ceil(total / pageSize) : 1
	const page = total > 0 ? Math.min(parsePage(query), maxPage) : 1
	const result = offsetTablePage({
		rows: sortedRows,
		page,
		pageSize: rawPageSize === ALL_PAGE_SIZE ? ALL_PAGE_SIZE : pageSize,
		maxPageSize: MAX_YIELDS_TABLE_PAGE_SIZE
	})

	return {
		rows: result.rows,
		total,
		// pageSize=all reports total (not the kernel's page:1/size:total split) — wire contract.
		page: rawPageSize === ALL_PAGE_SIZE ? 1 : result.page,
		pageSize,
		hasMore: result.hasMore
	}
}

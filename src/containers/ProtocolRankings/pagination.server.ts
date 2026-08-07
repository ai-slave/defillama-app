import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import { compareTableSortValues, cursorTablePage } from '~/server/tablePages/cursorPage.server'
import { hashTableQuerySignature } from '~/server/tablePages/preparedRows.server'
import { replaceAliases } from './customColumnsUtils'
import { createFormulaEvaluator, getSortableValue } from './formula.service'
import type { ProtocolRankingsSnapshotData } from './server/tableData.server'
import { getProtocolRankingSortValue, type ProtocolRankingSortValue } from './sortAccessors'
import {
	protocolRankingQuery,
	PROTOCOL_RANKINGS_LIMITS,
	type ProtocolRankingOrder,
	type ProtocolRankingPage as GenericProtocolRankingPage,
	type ProtocolRankingQuery
} from './tableQuery'
import type { IChildProtocol, IProtocol } from './types'

/**
 * Row-order policy for protocol rankings: how a snapshot's rows are filtered,
 * searched, and totally ordered for one canonical query, and how a page of
 * that order is served. Windowing mechanics (cursor encode/decode/verify)
 * live in ~/server/tablePages/cursorPage.server.
 */

export type ProtocolRankingPage = GenericProtocolRankingPage<IProtocol>

function rowId(row: IChildProtocol): string {
	return row.id ?? row.slug ?? row.name
}

function compareRowIds(a: IChildProtocol, b: IChildProtocol): number {
	const aId = rowId(a)
	const bId = rowId(b)
	return aId < bId ? -1 : aId > bId ? 1 : 0
}

function createSortValueGetter(query: ProtocolRankingQuery): (row: IChildProtocol) => ProtocolRankingSortValue {
	if (query.sort !== 'custom' || !query.customSort) {
		return (row) => getProtocolRankingSortValue(row, query.sort === 'custom' ? 'tvl' : query.sort)
	}
	const evaluate = createFormulaEvaluator(replaceAliases(query.customSort.formula))
	return (row) => {
		const result = evaluate(row)
		return result.status === 'success' ? getSortableValue(result.value, query.customSort?.formatType ?? 'auto') : null
	}
}

function createCachedSortValueGetter(query: ProtocolRankingQuery): (row: IChildProtocol) => ProtocolRankingSortValue {
	const getValue = createSortValueGetter(query)
	if (query.sort !== 'custom') return getValue
	const values = new WeakMap<IChildProtocol, ProtocolRankingSortValue>()
	return (row) => {
		if (values.has(row)) return values.get(row) ?? null
		const value = getValue(row)
		values.set(row, value)
		return value
	}
}

function compareRows(
	a: IChildProtocol,
	b: IChildProtocol,
	order: ProtocolRankingOrder,
	getSortValue: (row: IChildProtocol) => ProtocolRankingSortValue
): number {
	return compareTableSortValues(getSortValue(a), getSortValue(b), order) || compareRowIds(a, b)
}

function searchRows(rows: IProtocol[], rawSearch: string): IProtocol[] {
	const search = rawSearch.trim().toLowerCase()
	if (!search) return rows
	const matches = (name: string) => name.toLowerCase().includes(search)
	const filtered: IProtocol[] = []
	for (const row of rows) {
		if (matches(row.name)) {
			filtered.push(row)
			continue
		}
		const children = row.childProtocols?.filter((child) => matches(child.name))
		if (children?.length) filtered.push({ ...row, childProtocols: children })
	}
	return filtered
}

function enabledTvlSettings(tvlKeys: string[]): Record<string, boolean> {
	return Object.fromEntries(tvlKeys.map((key) => [key, true]))
}

export function getProtocolRankingRows(
	snapshot: ProtocolRankingsSnapshotData,
	query: ProtocolRankingQuery
): IProtocol[] {
	const getSortValue = createCachedSortValueGetter(query)
	const adjustedRows = applyProtocolTvlSettings({
		protocols: snapshot.protocols,
		extraTvlsEnabled: enabledTvlSettings(query.tvlKeys),
		minTvl: query.minTvl,
		maxTvl: query.maxTvl
	})
	return searchRows(adjustedRows, query.search)
		.map((row) =>
			row.childProtocols?.length
				? {
						...row,
						childProtocols: row.childProtocols.toSorted((a, b) => compareRows(a, b, query.order, getSortValue))
					}
				: row
		)
		.toSorted((a, b) => compareRows(a, b, query.order, getSortValue))
}

export function paginateProtocolRankingRows({
	snapshot,
	query,
	rows,
	cursor = null,
	limit = PROTOCOL_RANKINGS_LIMITS.page
}: {
	snapshot: ProtocolRankingsSnapshotData
	query: ProtocolRankingQuery
	rows: IProtocol[]
	cursor?: string | null
	limit?: number
}): ProtocolRankingPage {
	const page = cursorTablePage({
		rows,
		version: snapshot.snapshot,
		queryHash: hashTableQuerySignature(protocolRankingQuery.signature(query)),
		cursor,
		limit,
		maxLimit: PROTOCOL_RANKINGS_LIMITS.max,
		order: query.order,
		rowId,
		sortValue: createCachedSortValueGetter(query)
	})
	return {
		rows: page.rows,
		nextCursor: page.nextCursor,
		snapshot: page.version,
		total: page.total,
		hasMore: page.hasMore,
		availableActivityMetrics: snapshot.availableActivityMetrics
	}
}

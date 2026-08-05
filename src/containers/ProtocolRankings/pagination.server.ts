import { createHash } from 'node:crypto'
import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import { replaceAliases } from './customColumnsUtils'
import { createFormulaEvaluator, getSortableValue } from './formula.service'
import {
	PROTOCOL_RANKINGS_MAX_LIMIT,
	PROTOCOL_RANKINGS_PAGE_LIMIT,
	protocolRankingQuerySignature,
	type ProtocolRankingActivityMetricKey,
	type ProtocolRankingOrder,
	type ProtocolRankingPage as GenericProtocolRankingPage,
	type ProtocolRankingQuery
} from './query'
import {
	getProtocolRankingSortValue,
	PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS,
	type ProtocolRankingSortValue
} from './sortAccessors'
import type { IChildProtocol, IProtocol } from './types'

export type ProtocolRankingPage = GenericProtocolRankingPage<IProtocol>

export type ProtocolRankingsSnapshotData = {
	snapshot: string
	protocols: IProtocol[]
	availableActivityMetrics: ProtocolRankingActivityMetricKey[]
}

type CursorPayload = {
	v: 2
	snapshot: string
	queryHash: string
	lastValue: string | number | boolean | null
	lastId: string
	offset: number
}

function rowId(row: IChildProtocol): string {
	return row.id ?? row.slug ?? row.name
}

function compareRowIds(a: IChildProtocol, b: IChildProtocol): number {
	const aId = rowId(a)
	const bId = rowId(b)
	return aId < bId ? -1 : aId > bId ? 1 : 0
}

function compareValues(a: ProtocolRankingSortValue, b: ProtocolRankingSortValue, order: ProtocolRankingOrder): number {
	if (a === null && b === null) return 0
	if (a === null) return 1
	if (b === null) return -1
	const comparison = a < b ? -1 : a > b ? 1 : 0
	return order === 'desc' ? -comparison : comparison
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
	query: ProtocolRankingQuery,
	getSortValue: (row: IChildProtocol) => ProtocolRankingSortValue
): number {
	return compareValues(getSortValue(a), getSortValue(b), query.order) || compareRowIds(a, b)
}

function queryHash(query: ProtocolRankingQuery): string {
	return createHash('sha256').update(protocolRankingQuerySignature(query)).digest('base64url').slice(0, 22)
}

function encodeCursor(payload: CursorPayload): string {
	return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(cursor: string): CursorPayload | null {
	try {
		const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
		const value = parsed as Partial<CursorPayload>
		if (
			value.v !== 2 ||
			typeof value.snapshot !== 'string' ||
			typeof value.queryHash !== 'string' ||
			value.queryHash.length !== 22 ||
			typeof value.lastId !== 'string' ||
			typeof value.offset !== 'number' ||
			!Number.isSafeInteger(value.offset) ||
			value.offset < 1 ||
			(value.lastValue !== null &&
				typeof value.lastValue !== 'string' &&
				typeof value.lastValue !== 'number' &&
				typeof value.lastValue !== 'boolean')
		) {
			return null
		}
		return value as CursorPayload
	} catch {
		return null
	}
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

export function collectAvailableActivityMetrics(protocols: IProtocol[]): ProtocolRankingActivityMetricKey[] {
	return PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS.filter((key) =>
		protocols.some((protocol) => protocol[key] !== undefined)
	)
}

export function getProtocolRankingRows(
	snapshot: ProtocolRankingsSnapshotData,
	query: ProtocolRankingQuery
): IProtocol[] {
	return getProtocolRankingRowsWithSortValues(snapshot, query, createCachedSortValueGetter(query))
}

function getProtocolRankingRowsWithSortValues(
	snapshot: ProtocolRankingsSnapshotData,
	query: ProtocolRankingQuery,
	getSortValue: (row: IChildProtocol) => ProtocolRankingSortValue
): IProtocol[] {
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
						childProtocols: row.childProtocols.toSorted((a, b) => compareRows(a, b, query, getSortValue))
					}
				: row
		)
		.toSorted((a, b) => compareRows(a, b, query, getSortValue))
}

export function queryProtocolRankingSnapshot({
	snapshot,
	query,
	cursor = null,
	limit = PROTOCOL_RANKINGS_PAGE_LIMIT
}: {
	snapshot: ProtocolRankingsSnapshotData
	query: ProtocolRankingQuery
	cursor?: string | null
	limit?: number
}): ProtocolRankingPage {
	return paginateProtocolRankingRows({
		snapshot,
		query,
		rows: getProtocolRankingRows(snapshot, query),
		cursor,
		limit
	})
}

export function paginateProtocolRankingRows({
	snapshot,
	query,
	rows: sorted,
	cursor = null,
	limit = PROTOCOL_RANKINGS_PAGE_LIMIT
}: {
	snapshot: ProtocolRankingsSnapshotData
	query: ProtocolRankingQuery
	rows: IProtocol[]
	cursor?: string | null
	limit?: number
}): ProtocolRankingPage {
	const safeLimit = Math.max(1, Math.min(PROTOCOL_RANKINGS_MAX_LIMIT, Math.trunc(limit)))
	const getSortValue = createCachedSortValueGetter(query)
	const signatureHash = queryHash(query)
	let start = 0
	if (cursor) {
		const decoded = decodeCursor(cursor)
		if (!decoded || decoded.snapshot !== snapshot.snapshot || decoded.queryHash !== signatureHash) {
			throw new ProtocolRankingCursorError('The ranking cursor does not match this snapshot and query')
		}
		const previous = sorted[decoded.offset - 1]
		if (
			!previous ||
			rowId(previous) !== decoded.lastId ||
			compareValues(getSortValue(previous), decoded.lastValue, query.order) !== 0
		) {
			throw new ProtocolRankingCursorError('The ranking cursor position is invalid')
		}
		start = decoded.offset
	}
	const rows = sorted.slice(start, start + safeLimit)
	const hasMore = start + rows.length < sorted.length
	const lastRow = rows.at(-1)
	const nextCursor =
		hasMore && lastRow
			? encodeCursor({
					v: 2,
					snapshot: snapshot.snapshot,
					queryHash: signatureHash,
					lastValue: getSortValue(lastRow),
					lastId: rowId(lastRow),
					offset: start + rows.length
				})
			: null

	return {
		rows,
		nextCursor,
		snapshot: snapshot.snapshot,
		total: sorted.length,
		hasMore,
		availableActivityMetrics: snapshot.availableActivityMetrics
	}
}

export class ProtocolRankingCursorError extends Error {}

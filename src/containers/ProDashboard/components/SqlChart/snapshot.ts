import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { normalizeSqlResultRows } from '~/containers/Downloads/sql/resultNormalization'
import type { SqlSnapshot } from '../../types'

export const SQL_SNAPSHOT_ROW_CAP = 1000
export const SQL_SNAPSHOT_ROW_CAP_MIN = 100
export const SQL_SNAPSHOT_ROW_CAP_MAX = 5000

export function clampRowCap(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return SQL_SNAPSHOT_ROW_CAP
	return Math.min(SQL_SNAPSHOT_ROW_CAP_MAX, Math.max(SQL_SNAPSHOT_ROW_CAP_MIN, Math.round(value)))
}

function toJsonSafe(value: unknown): unknown {
	if (typeof value === 'bigint') {
		return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER ? Number(value) : value.toString()
	}
	if (value instanceof Date) return value.toISOString()
	if (Array.isArray(value)) return value.map(toJsonSafe)
	if (value !== null && typeof value === 'object') {
		const out: Record<string, unknown> = {}
		for (const key of Object.keys(value as Record<string, unknown>)) {
			out[key] = toJsonSafe((value as Record<string, unknown>)[key])
		}
		return out
	}
	return value
}

export function captureSnapshot(
	result: QueryResult,
	engine: SqlSnapshot['engine'] = 'browser',
	computedAt: string = new Date().toISOString(),
	rowCap: number = SQL_SNAPSHOT_ROW_CAP
): SqlSnapshot {
	const cap = clampRowCap(rowCap)
	const rowCount = result.rows.length
	const truncated = rowCount > cap
	const inputRows = truncated ? result.rows.slice(0, cap) : result.rows
	const rows = new Array<unknown[]>(inputRows.length)
	for (let rowIndex = 0; rowIndex < inputRows.length; rowIndex++) {
		const input = inputRows[rowIndex]
		const row = new Array<unknown>(input.length)
		for (let columnIndex = 0; columnIndex < input.length; columnIndex++) {
			row[columnIndex] = toJsonSafe(input[columnIndex])
		}
		rows[rowIndex] = row
	}
	return {
		columns: result.columns.map((c) => ({ name: c.name, type: c.type })),
		rows,
		computedAt,
		rowCount,
		truncated: truncated ? true : undefined,
		engine
	}
}

export function snapshotToResult(snapshot: SqlSnapshot): QueryResult {
	const firstRow = snapshot.rows[0]
	if (firstRow == null || Array.isArray(firstRow)) {
		return { columns: snapshot.columns, rows: snapshot.rows as unknown[][] }
	}

	const legacyRows = snapshot.rows as Record<string, unknown>[]
	const rows = new Array<unknown[]>(legacyRows.length)
	for (let rowIndex = 0; rowIndex < legacyRows.length; rowIndex++) {
		const input = legacyRows[rowIndex]
		const row = new Array<unknown>(snapshot.columns.length)
		for (let columnIndex = 0; columnIndex < snapshot.columns.length; columnIndex++) {
			row[columnIndex] = input[snapshot.columns[columnIndex].name]
		}
		rows[rowIndex] = row
	}
	return normalizeSqlResultRows({ columns: snapshot.columns, rows })
}

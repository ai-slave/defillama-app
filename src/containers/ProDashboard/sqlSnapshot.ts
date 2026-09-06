import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { normalizeSqlResultRows } from '~/containers/Downloads/sql/resultNormalization'
import type { SqlSnapshot, SqlSnapshotValue } from './types'

export const SQL_SNAPSHOT_ROW_CAP = 1000
export const SQL_SNAPSHOT_ROW_CAP_MIN = 100
export const SQL_SNAPSHOT_ROW_CAP_MAX = 5000

export function clampRowCap(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return SQL_SNAPSHOT_ROW_CAP
	return Math.min(SQL_SNAPSHOT_ROW_CAP_MAX, Math.max(SQL_SNAPSHOT_ROW_CAP_MIN, Math.round(value)))
}

function isPlainRecord(value: object): value is Record<string, unknown> {
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

function hasJsonRepresentation(value: object): value is { toJSON: () => unknown } {
	return typeof (value as { toJSON?: unknown }).toJSON === 'function'
}

function toJsonSafe(value: QueryResult['rows'][number][number]): SqlSnapshotValue {
	if (value === null) return null
	if (typeof value === 'string') return value
	if (typeof value === 'boolean') return value
	if (typeof value === 'number') return Number.isFinite(value) ? value : null
	if (typeof value === 'bigint') {
		return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER ? Number(value) : value.toString()
	}
	if (value instanceof Date) return value.toISOString()
	if (Array.isArray(value)) return value.map(toJsonSafe)
	if (typeof value === 'object') {
		// DuckDB-Wasm exposes LIST and STRUCT cells as Arrow wrappers with JSON representations.
		if (!isPlainRecord(value)) return hasJsonRepresentation(value) ? toJsonSafe(value.toJSON()) : null
		const out: Record<string, SqlSnapshotValue> = {}
		for (const [key, nestedValue] of Object.entries(value)) {
			if (nestedValue !== undefined) out[key] = toJsonSafe(nestedValue)
		}
		return out
	}
	return null
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
	const rows: Array<Array<SqlSnapshotValue>> = new Array(inputRows.length)
	for (let rowIndex = 0; rowIndex < inputRows.length; rowIndex++) {
		const input = inputRows[rowIndex]
		if (input === undefined) throw new Error(`Missing SQL snapshot row ${rowIndex}`)
		const row = new Array<SqlSnapshotValue>(input.length)
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
		...(truncated ? { truncated: true } : {}),
		engine
	}
}

export function snapshotToResult(snapshot: SqlSnapshot): QueryResult {
	const rows: QueryResult['rows'] = new Array(snapshot.rows.length)
	for (let rowIndex = 0; rowIndex < snapshot.rows.length; rowIndex++) {
		const input = snapshot.rows[rowIndex]
		if (input === undefined) throw new Error(`Missing persisted SQL snapshot row ${rowIndex}`)
		if (Array.isArray(input)) {
			rows[rowIndex] = input
			continue
		}
		const row: QueryResult['rows'][number] = new Array(snapshot.columns.length)
		for (let columnIndex = 0; columnIndex < snapshot.columns.length; columnIndex++) {
			const column = snapshot.columns[columnIndex]
			if (column === undefined) throw new Error(`Missing persisted SQL snapshot column ${columnIndex}`)
			row[columnIndex] = input[column.name]
		}
		rows[rowIndex] = row
	}
	return normalizeSqlResultRows({ columns: snapshot.columns, rows })
}

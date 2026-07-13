import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import type { SqlSnapshot } from '../../types'

export const SQL_SNAPSHOT_ROW_CAP = 1000
export const SQL_SNAPSHOT_ROW_CAP_MIN = 100
export const SQL_SNAPSHOT_ROW_CAP_MAX = 5000

export function clampRowCap(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return SQL_SNAPSHOT_ROW_CAP
	return Math.min(SQL_SNAPSHOT_ROW_CAP_MAX, Math.max(SQL_SNAPSHOT_ROW_CAP_MIN, Math.round(value)))
}

function toJsonSafe(value: unknown): unknown {
	if (typeof value === 'bigint') return Number(value)
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

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	for (const key of Object.keys(row)) out[key] = toJsonSafe(row[key])
	return out
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
	const rows = (truncated ? result.rows.slice(0, cap) : result.rows).map(sanitizeRow)
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
	return { columns: snapshot.columns, rows: snapshot.rows }
}

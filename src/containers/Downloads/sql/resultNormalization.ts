import { classifyColumns } from './columnKind'
import type { QueryResult } from './exportResults'

function normalizeInteger(value: unknown): unknown {
	if (typeof value === 'number') return value
	if (typeof value === 'bigint') {
		return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER ? Number(value) : value.toString()
	}
	const text =
		value !== null && typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value
	if (typeof text !== 'string' || text.trim() === '') return text
	const numeric = Number(text)
	return Number.isSafeInteger(numeric) ? numeric : text
}

function normalizeFloat(value: unknown): unknown {
	if (typeof value === 'number') return value
	if (typeof value === 'bigint') {
		return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER ? Number(value) : value.toString()
	}
	const text =
		value !== null && typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value
	if (typeof text !== 'string' || text.trim() === '') return text
	const numeric = Number(text)
	return Number.isFinite(numeric) ? numeric : text
}

function normalizeDate(value: unknown): unknown {
	if (value instanceof Date) {
		const timestamp = value.getTime()
		return Number.isFinite(timestamp) ? timestamp : null
	}
	if (typeof value === 'number') return Math.abs(value) < 1e12 ? value * 1000 : value
	if (typeof value === 'bigint') {
		if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) return value.toString()
		const numeric = Number(value)
		return Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric
	}
	if (typeof value !== 'string' || value === '') return value
	const timestamp = Date.parse(value)
	return Number.isFinite(timestamp) ? timestamp : value
}

/**
 * Normalize DuckDB/Arrow scalar values once, immediately after execution.
 * Numeric chart columns become numbers and dates become Unix milliseconds;
 * unsafe integers stay strings so tables and downloads retain their exact value.
 */
export function normalizeSqlResultRows(result: QueryResult): QueryResult {
	const columnKinds = classifyColumns(result)
	for (const row of result.rows) {
		for (let columnIndex = 0; columnIndex < columnKinds.length; columnIndex++) {
			const value = row[columnIndex]
			if (value == null) {
				row[columnIndex] = null
				continue
			}
			switch (columnKinds[columnIndex].fine) {
				case 'int':
					row[columnIndex] = normalizeInteger(value)
					break
				case 'float':
					row[columnIndex] = normalizeFloat(value)
					break
				case 'date':
					row[columnIndex] = normalizeDate(value)
					break
			}
		}
	}
	return result
}

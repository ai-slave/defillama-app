import { parseCsv } from '~/containers/Downloads/csvParse'
import { looksLikeISODate } from '~/containers/Downloads/sql/columnKind'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import type { CustomDataColumn, SqlSnapshotValue } from '../../types'

export const CUSTOM_DATA_MAX_TEXT_LENGTH = 200 * 1024
export const CUSTOM_DATA_MAX_COLUMNS = 30
export const CUSTOM_DATA_MAX_ROWS = 5000

export type CustomDataColumnType = 'BIGINT' | 'DOUBLE' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP' | 'VARCHAR'

export interface ParsedCustomData {
	columns: Array<CustomDataColumn>
	rows: Array<Array<SqlSnapshotValue>>
	result: QueryResult
}

export class CustomDataParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'CustomDataParseError'
	}
}

const INTEGER_PATTERN = /^-?\d{1,18}$/
const NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
const BOOLEAN_VALUES = new Set(['true', 'false'])

function isEmptyCell(value: string) {
	return value.trim() === ''
}

function detectColumnType(values: Array<string>): CustomDataColumnType {
	let sawValue = false
	let allIntegers = true
	let allNumbers = true
	let allBooleans = true
	let allDates = true
	let sawTime = false
	for (const raw of values) {
		if (isEmptyCell(raw)) continue
		const value = raw.trim()
		sawValue = true
		if (allIntegers && !INTEGER_PATTERN.test(value)) allIntegers = false
		if (allNumbers && !NUMBER_PATTERN.test(value)) allNumbers = false
		if (allBooleans && !BOOLEAN_VALUES.has(value.toLowerCase())) allBooleans = false
		if (allDates) {
			if (!looksLikeISODate(value)) allDates = false
			else if (value.length > 10) sawTime = true
		}
		if (!allIntegers && !allNumbers && !allBooleans && !allDates) break
	}
	if (!sawValue) return 'VARCHAR'
	if (allIntegers) return 'BIGINT'
	if (allNumbers) return 'DOUBLE'
	if (allBooleans) return 'BOOLEAN'
	if (allDates) return sawTime ? 'TIMESTAMP' : 'DATE'
	return 'VARCHAR'
}

function castCell(raw: string, type: CustomDataColumnType): SqlSnapshotValue {
	if (isEmptyCell(raw)) return null
	const value = raw.trim()
	switch (type) {
		case 'BIGINT':
		case 'DOUBLE': {
			const parsed = Number(value)
			return Number.isFinite(parsed) ? parsed : null
		}
		case 'BOOLEAN':
			return value.toLowerCase() === 'true'
		case 'DATE':
		case 'TIMESTAMP': {
			const timestamp = Date.parse(value)
			return Number.isFinite(timestamp) ? timestamp : value
		}
		case 'VARCHAR':
			return raw
	}
}

function uniqueColumnNames(headers: Array<string>): Array<string> {
	const taken = new Set<string>()
	return headers.map((header, index) => {
		const base = header.trim() || `column_${index + 1}`
		let name = base
		for (let suffix = 2; taken.has(name); suffix += 1) name = `${base}_${suffix}`
		taken.add(name)
		return name
	})
}

export function assertCustomDataSizeAllowed(size: number) {
	if (size > CUSTOM_DATA_MAX_TEXT_LENGTH) {
		throw new CustomDataParseError(
			`CSV is too large (${Math.round(size / 1024)} KB). The limit is ${CUSTOM_DATA_MAX_TEXT_LENGTH / 1024} KB.`
		)
	}
}

export function parseCustomDataCsv(text: string): ParsedCustomData {
	assertCustomDataSizeAllowed(text.length)
	const parsed = parseCsv(text)
	if (parsed.headers.length === 0) throw new CustomDataParseError('The CSV has no header row.')
	if (parsed.headers.length > CUSTOM_DATA_MAX_COLUMNS) {
		throw new CustomDataParseError(
			`The CSV has ${parsed.headers.length} columns. The limit is ${CUSTOM_DATA_MAX_COLUMNS}.`
		)
	}
	if (parsed.rows.length === 0) throw new CustomDataParseError('The CSV has a header but no data rows.')
	if (parsed.rows.length > CUSTOM_DATA_MAX_ROWS) {
		throw new CustomDataParseError(`The CSV has ${parsed.rows.length} rows. The limit is ${CUSTOM_DATA_MAX_ROWS}.`)
	}
	const names = uniqueColumnNames(parsed.headers)
	for (const row of parsed.rows) {
		if (row.values.length !== names.length) {
			throw new CustomDataParseError(`Row ${row.id + 2} has ${row.values.length} columns, expected ${names.length}.`)
		}
	}
	const types = names.map((_, columnIndex) => detectColumnType(parsed.rows.map((row) => row.values[columnIndex] ?? '')))
	const rows: Array<Array<SqlSnapshotValue>> = parsed.rows.map((row) =>
		row.values.map((value, columnIndex) => castCell(value, types[columnIndex] ?? 'VARCHAR'))
	)
	const columns: Array<CustomDataColumn> = names.map((name, index) => ({ name, type: types[index] ?? 'VARCHAR' }))
	return { columns, rows, result: { columns, rows } }
}

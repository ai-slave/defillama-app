import type { CsvCell } from './csvCell'

export type CsvSerializableCell = CsvCell | object
export type CsvData = CsvSerializableCell[][] | string

const CSV_FORMULA_PREFIX_REGEX = /^[=+\-@\t\r\n＝＋－＠]/u

export function serializeCsvRow(row: readonly CsvSerializableCell[]): string {
	return row
		.map((cell) => {
			if (cell == null) return ''
			// Preserve typed negative numbers; only text can be interpreted as a spreadsheet formula.
			const formulaPrefixed = typeof cell === 'string' && CSV_FORMULA_PREFIX_REGEX.test(cell)
			const cellString = typeof cell === 'object' ? JSON.stringify(cell) : formulaPrefixed ? `'${cell}` : String(cell)
			if (formulaPrefixed || cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
				return `"${cellString.replace(/"/g, '""')}"`
			}
			return cellString
		})
		.join(',')
}

export function serializeCsv(csvData: CsvData): string {
	if (!Array.isArray(csvData)) return String(csvData)
	return csvData.map(serializeCsvRow).join('\n')
}

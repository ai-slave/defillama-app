import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { CsvSerializableCell } from '~/utils/csv'
import { downloadTabular, type DownloadFormat } from '~/utils/download'
import { classifyColumns } from './columnKind'

export interface QueryResult {
	columns: Array<{ name: string; type: string }>
	rows: Array<Array<unknown>>
}

// LlamaSQL/Arrow results contain native types that the CSV writer can't round-trip directly.
// Convert once, here, and pass serializable cells to the shared downloadTabular pipeline so we
// reuse the same escaping, file-naming, and analytics hooks as the rest of the app.
export function exportQueryResult(result: QueryResult, format: DownloadFormat, filename = 'query-result'): void {
	trackUmamiEvent('sql-studio-download', { format })
	if (!result || result.rows.length === 0) {
		// Still emit an empty file so "nothing happened" isn't the UX for empty results.
		downloadTabular(format, filename, [result.columns.map((c) => c.name)], { addTimestamp: true })
		return
	}
	const header: Array<CsvSerializableCell> = result.columns.map((c) => c.name)
	const columnKinds = classifyColumns(result)
	const data: Array<Array<CsvSerializableCell>> = result.rows.map((row) =>
		result.columns.map((_, index) => toCell(row[index], columnKinds[index].fine === 'date'))
	)
	downloadTabular(format, filename, [header, ...data], { addTimestamp: true })
}

function toCell(value: unknown, isDate: boolean): CsvSerializableCell {
	if (value === null || value === undefined) return ''
	if (isDate && typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
	if (typeof value === 'bigint') return value.toString()
	if (value instanceof Date) return value.toISOString()
	if (typeof value === 'object') {
		// Arrow lists and structs may contain bigint values that JSON cannot encode directly.
		return JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry))
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
	return String(value)
}

import { replaceAliases } from './customColumnsUtils'
import { createFormulaEvaluator } from './formula.service'
import { isProtocolRankingSortKey } from './query'
import { getProtocolRankingSortValue } from './sortAccessors'
import type { IProtocol } from './types'

export type ProtocolRankingExportColumn = {
	key: string
	name: string
	formula?: string
}

function csvValue(value: unknown): string {
	if (value == null) return ''
	const raw = Array.isArray(value) ? value.join(', ') : String(value)
	let firstVisibleIndex = 0
	while (firstVisibleIndex < raw.length && raw.charCodeAt(firstVisibleIndex) <= 32) firstVisibleIndex += 1
	const safe = '=+-@'.includes(raw.charAt(firstVisibleIndex)) ? `'${raw}` : raw
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function standardColumnValue(row: IProtocol, key: string): unknown {
	if (key === 'name') return row.name
	if (key === 'category') return row.category
	if (isProtocolRankingSortKey(key)) return getProtocolRankingSortValue(row, key)
	return null
}

export function buildProtocolRankingsCsv({
	rows,
	columns
}: {
	rows: IProtocol[]
	columns: ProtocolRankingExportColumn[]
}): string {
	const safeColumns = columns
		.filter(
			(column) =>
				column &&
				typeof column.key === 'string' &&
				typeof column.name === 'string' &&
				column.key.length <= 100 &&
				column.name.length <= 100 &&
				(column.formula === undefined || (typeof column.formula === 'string' && column.formula.length <= 500))
		)
		.slice(0, 100)
	const evaluators = safeColumns.map((column) =>
		column.formula ? createFormulaEvaluator(replaceAliases(column.formula)) : null
	)
	const lines = [safeColumns.map((column) => csvValue(column.name)).join(',')]
	for (const row of rows) {
		lines.push(
			safeColumns
				.map((column, index) => {
					const evaluator = evaluators[index]
					if (!evaluator) return csvValue(standardColumnValue(row, column.key))
					const result = evaluator(row)
					return csvValue(result.status === 'success' ? result.value : null)
				})
				.join(',')
		)
	}
	return lines.join('\r\n')
}

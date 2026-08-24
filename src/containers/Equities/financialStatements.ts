import type { IEquitiesStatementsResponse } from './api.types'
import type { IEquitiesStatementTableRow } from './types'

export const EQUITIES_STATEMENT_OPTIONS = ['Income Statement', 'Balance Sheet', 'Cash Flow'] as const
export const EQUITIES_STATEMENT_PERIOD_OPTIONS = ['Quarterly', 'Annual'] as const

export type EquitiesStatementOption = (typeof EQUITIES_STATEMENT_OPTIONS)[number]
export type EquitiesStatementPeriodOption = (typeof EQUITIES_STATEMENT_PERIOD_OPTIONS)[number]

type StatementSectionKey = keyof IEquitiesStatementsResponse
type StatementPeriodKey = 'quarterly' | 'annual'

export const equitiesStatementSectionMap: Record<EquitiesStatementOption, StatementSectionKey> = {
	'Income Statement': 'incomeStatement',
	'Balance Sheet': 'balanceSheet',
	'Cash Flow': 'cashflow'
}

export const equitiesStatementPeriodMap: Record<EquitiesStatementPeriodOption, StatementPeriodKey> = {
	Quarterly: 'quarterly',
	Annual: 'annual'
}

function getRequiredStatementRow(
	rows: Array<Array<number | null>>,
	index: number,
	label: string
): Array<number | null> {
	const row = rows[index]
	if (!row) throw new Error(`Missing statement values for ${label}`)
	return row
}

export function buildEquitiesStatementRows(
	statements: IEquitiesStatementsResponse,
	statementType: EquitiesStatementOption,
	periodType: EquitiesStatementPeriodOption
): IEquitiesStatementTableRow[] {
	const section = statements[equitiesStatementSectionMap[statementType]]
	const periodKey = equitiesStatementPeriodMap[periodType]
	const periodData = section[periodKey]
	const childrenMeta = section.children[periodKey]
	const rows: IEquitiesStatementTableRow[] = []

	let rowIndex = 0
	for (const label of section.labels) {
		const childLabels = childrenMeta[label]?.labels
		let subRows: IEquitiesStatementTableRow[] | undefined

		if (childLabels && childLabels.length > 0) {
			const childData = periodData.children[label]
			if (!childData) throw new Error(`Missing statement breakdown values for ${label}`)
			subRows = []
			let childIndex = 0
			for (const childLabel of childLabels) {
				subRows.push({
					id: `${label}-${childLabel}`,
					label: childLabel,
					values: getRequiredStatementRow(childData.values, childIndex, `${label} / ${childLabel}`),
					depth: 1
				})
				childIndex++
			}
		}

		rows.push({
			id: label,
			label,
			values: getRequiredStatementRow(periodData.values, rowIndex, label),
			depth: 0,
			...(subRows ? { subRows } : {})
		})
		rowIndex++
	}

	return rows
}

export interface EquitiesStatementHeader {
	index: number
	periodEnding: string
}

export function getEquitiesStatementValue(
	row: IEquitiesStatementTableRow,
	header: EquitiesStatementHeader
): number | null {
	const value = row.values[header.index]
	if (value === undefined) throw new Error(`Missing ${row.label} value for ${header.periodEnding}`)
	return value
}

export function getEquitiesStatementHeaders(periodEnding: string[]): EquitiesStatementHeader[] {
	const headers: EquitiesStatementHeader[] = []
	let index = 0
	for (const date of periodEnding) {
		headers.push({ index, periodEnding: date })
		index++
	}
	return headers.sort(
		(a, b) => new Date(`${b.periodEnding}T00:00:00Z`).getTime() - new Date(`${a.periodEnding}T00:00:00Z`).getTime()
	)
}

export function flattenEquitiesStatementRows(rows: IEquitiesStatementTableRow[]): IEquitiesStatementTableRow[] {
	const flattened: IEquitiesStatementTableRow[] = []
	for (const row of rows) {
		flattened.push(row)
		if (row.subRows?.length) flattened.push(...row.subRows)
	}
	return flattened
}

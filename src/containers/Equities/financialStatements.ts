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

export function getAvailableEquitiesStatementOptions(
	statements: IEquitiesStatementsResponse
): EquitiesStatementOption[] {
	const available: EquitiesStatementOption[] = []
	for (const option of EQUITIES_STATEMENT_OPTIONS) {
		if (statements[equitiesStatementSectionMap[option]]) available.push(option)
	}
	return available
}

export function resolveEquitiesStatementOption(
	statements: IEquitiesStatementsResponse,
	requested: EquitiesStatementOption
): EquitiesStatementOption {
	if (statements[equitiesStatementSectionMap[requested]]) return requested
	// The equities API guarantees at least one statement section, though each named section is optional.
	return getAvailableEquitiesStatementOptions(statements)[0]!
}

export function buildEquitiesStatementRows(
	statements: IEquitiesStatementsResponse,
	statementType: EquitiesStatementOption,
	periodType: EquitiesStatementPeriodOption
): IEquitiesStatementTableRow[] {
	const section = statements[equitiesStatementSectionMap[statementType]]!
	const periodKey = equitiesStatementPeriodMap[periodType]
	const periodData = section[periodKey]
	const childrenMeta = section.children[periodKey]
	const rows: IEquitiesStatementTableRow[] = []

	for (let rowIndex = 0; rowIndex < section.labels.length; rowIndex++) {
		const label = section.labels[rowIndex]
		const childLabels = childrenMeta[label]?.labels ?? []
		const childValues = periodData.children[label]?.values ?? []
		let subRows: IEquitiesStatementTableRow[] | undefined

		if (childLabels.length > 0) {
			subRows = []
			for (let childIndex = 0; childIndex < childLabels.length; childIndex++) {
				const childLabel = childLabels[childIndex]
				subRows.push({
					id: `${label}-${childLabel}`,
					label: childLabel,
					values: childValues[childIndex] ?? [],
					depth: 1
				})
			}
		}

		rows.push({
			id: label,
			label,
			values: periodData.values[rowIndex] ?? [],
			depth: 0,
			subRows
		})
	}

	return rows
}

export function getEquitiesStatementHeaderIndexes(periodEnding: string[]): number[] {
	const indexes: number[] = []
	for (let index = 0; index < periodEnding.length; index++) indexes.push(index)
	return indexes.sort((a, b) => {
		const aTime = new Date(`${periodEnding[a] ?? ''}T00:00:00Z`).getTime()
		const bTime = new Date(`${periodEnding[b] ?? ''}T00:00:00Z`).getTime()
		return bTime - aTime
	})
}

export function flattenEquitiesStatementRows(rows: IEquitiesStatementTableRow[]): IEquitiesStatementTableRow[] {
	const flattened: IEquitiesStatementTableRow[] = []
	for (const row of rows) {
		flattened.push(row)
		if (row.subRows?.length) flattened.push(...row.subRows)
	}
	return flattened
}

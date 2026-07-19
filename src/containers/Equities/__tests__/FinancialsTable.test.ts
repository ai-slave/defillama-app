import { describe, expect, it } from 'vitest'
import type { IEquitiesStatementsResponse } from '../api.types'
import { getStatementHeaderIndexes } from '../FinancialsTable'
import { getAvailableEquitiesStatementOptions, resolveEquitiesStatementOption } from '../financialStatements'

const statementSection = {
	labels: ['Revenue'],
	children: { quarterly: {}, annual: {} },
	quarterly: { periodEnding: ['2026-03-31'], values: [[1]], children: {} },
	annual: { periodEnding: ['2025-12-31'], values: [[4]], children: {} }
}

describe('equities financials statement headers', () => {
	it('orders periodEnding values from newest to oldest', () => {
		expect(getStatementHeaderIndexes(['1984-03-31', '1984-09-30', '1984-06-30'])).toEqual([1, 2, 0])
	})

	it('falls back to the first section the API returned', () => {
		const statements: IEquitiesStatementsResponse = { balanceSheet: statementSection }

		expect(getAvailableEquitiesStatementOptions(statements)).toEqual(['Balance Sheet'])
		expect(resolveEquitiesStatementOption(statements, 'Income Statement')).toBe('Balance Sheet')
	})

	it('keeps the requested section when it is available', () => {
		const statements: IEquitiesStatementsResponse = {
			incomeStatement: statementSection,
			balanceSheet: statementSection
		}

		expect(resolveEquitiesStatementOption(statements, 'Income Statement')).toBe('Income Statement')
	})
})

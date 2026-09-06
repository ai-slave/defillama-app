import { describe, expect, test } from 'vitest'
import type { IEquitiesStatementsResponse } from '../api.types'
import { getStatementHeaders } from '../FinancialsTable'
import { buildEquitiesStatementRows, getEquitiesStatementValue } from '../financialStatements'

const statementSection = {
	labels: ['Revenue'],
	children: { quarterly: {}, annual: {} },
	quarterly: { periodEnding: ['2026-03-31'], values: [[1]], children: {} },
	annual: { periodEnding: ['2025-12-31'], values: [[4]], children: {} }
}

describe('equities financials statement headers', () => {
	test('orders periodEnding values from newest to oldest', () => {
		expect(getStatementHeaders(['1984-03-31', '1984-09-30', '1984-06-30'])).toEqual([
			{ index: 1, periodEnding: '1984-09-30' },
			{ index: 2, periodEnding: '1984-06-30' },
			{ index: 0, periodEnding: '1984-03-31' }
		])
	})

	test('keeps all required sections present when one has no periods', () => {
		const emptySection = {
			...statementSection,
			quarterly: { periodEnding: [], values: [[]], children: {} },
			annual: { periodEnding: [], values: [[]], children: {} }
		}
		const statements: IEquitiesStatementsResponse = {
			incomeStatement: emptySection,
			balanceSheet: statementSection,
			cashflow: statementSection
		}

		expect(buildEquitiesStatementRows(statements, 'Income Statement', 'Quarterly')).toEqual([
			{ id: 'Revenue', label: 'Revenue', values: [], depth: 0 }
		])
	})

	test('keeps parent and child values aligned with sorted headers', () => {
		const incomeStatement = {
			labels: ['Revenue'],
			children: {
				quarterly: { Revenue: { labels: ['Product'] } },
				annual: {}
			},
			quarterly: {
				periodEnding: ['1984-03-31', '1984-09-30', '1984-06-30'],
				values: [[10, null, 0]],
				children: { Revenue: { values: [[null, 20, 0]] } }
			},
			annual: { periodEnding: [], values: [[]], children: {} }
		}
		const statements: IEquitiesStatementsResponse = {
			incomeStatement,
			balanceSheet: statementSection,
			cashflow: statementSection
		}
		const headers = getStatementHeaders(incomeStatement.quarterly.periodEnding)
		const [row] = buildEquitiesStatementRows(statements, 'Income Statement', 'Quarterly')
		if (!row) throw new Error('Missing Revenue row')
		const [childRow] = row.subRows ?? []
		if (!childRow) throw new Error('Missing Product row')
		const [newestHeader] = headers
		if (!newestHeader) throw new Error('Missing newest statement header')

		expect(headers.map(({ index }) => row.values[index])).toEqual([null, 0, 10])
		expect(headers.map(({ index }) => childRow.values[index])).toEqual([20, 0, null])
		expect(getEquitiesStatementValue(row, newestHeader)).toBeNull()
	})

	test('rejects malformed producer row and cell alignment', () => {
		const missingParentRow: IEquitiesStatementsResponse = {
			incomeStatement: {
				...statementSection,
				quarterly: { periodEnding: ['2026-03-31'], values: [], children: {} }
			},
			balanceSheet: statementSection,
			cashflow: statementSection
		}
		const missingChildRow: IEquitiesStatementsResponse = {
			incomeStatement: {
				...statementSection,
				children: { quarterly: { Revenue: { labels: ['Product'] } }, annual: {} },
				quarterly: { periodEnding: ['2026-03-31'], values: [[1]], children: {} }
			},
			balanceSheet: statementSection,
			cashflow: statementSection
		}

		expect(() => buildEquitiesStatementRows(missingParentRow, 'Income Statement', 'Quarterly')).toThrow(
			'Missing statement values for Revenue'
		)
		expect(() => buildEquitiesStatementRows(missingChildRow, 'Income Statement', 'Quarterly')).toThrow(
			'Missing statement breakdown values for Revenue'
		)
		expect(() =>
			getEquitiesStatementValue(
				{ id: 'Revenue', label: 'Revenue', values: [], depth: 0 },
				{ index: 0, periodEnding: '2026-03-31' }
			)
		).toThrow('Missing Revenue value for 2026-03-31')
	})
})

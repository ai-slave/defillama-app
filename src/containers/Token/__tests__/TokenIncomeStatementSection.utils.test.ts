import { expect, test } from 'vitest'
import { describeIncomeStatementComponents } from '../TokenIncomeStatementSection.utils'

test('describes the protocols and chains a token income statement sums', () => {
	expect(
		describeIncomeStatementComponents([
			{ name: 'Arbitrum Foundation', id: 'parent#arbitrum-foundation', protocolType: 'protocol', module: null },
			{ name: 'Arbitrum', id: 'chain#arbitrum', protocolType: 'chain', module: 'arbitrum' }
		])
	).toBe('Include incomes from Arbitrum Foundation, Arbitrum Chain')
	expect(describeIncomeStatementComponents([])).toBeUndefined()
	expect(describeIncomeStatementComponents(undefined)).toBeUndefined()
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('~/containers/ProtocolOverview/IncomeStatement', () => ({
	IncomeStatement: ({ name, description }: { name: string; description?: string }) => (
		<div>
			<h2>{`Income Statement for ${name}`}</h2>
			{description ? <p>{description}</p> : null}
		</div>
	)
}))

import { TokenIncomeStatementSection } from '../TokenIncomeStatementSection'

const incomeStatement = {
	data: {},
	labelsByType: {},
	methodology: {},
	breakdownMethodology: {},
	hasOtherTokenHolderFlows: false,
	hasTokenHolderNetIncome: false,
	components: [
		{ name: 'Arbitrum Foundation', id: 'parent#arbitrum-foundation', protocolType: 'protocol', module: null },
		{ name: 'Arbitrum', id: 'chain#arbitrum', protocolType: 'chain', module: 'arbitrum' }
	]
}

describe('TokenIncomeStatementSection', () => {
	it('uses the token symbol and describes the API components', () => {
		const html = renderToStaticMarkup(
			<TokenIncomeStatementSection tokenSymbol="ARB" incomeStatement={incomeStatement} />
		)

		expect(html).toContain('Income Statement for ARB')
		expect(html).toContain('Include incomes from Arbitrum Foundation, Arbitrum Chain')
	})
})

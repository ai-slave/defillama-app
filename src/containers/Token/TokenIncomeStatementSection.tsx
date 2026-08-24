import { IncomeStatement } from '~/containers/ProtocolOverview/IncomeStatement'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'

const TOKEN_INCOME_STATEMENT_SECTION_ID = 'token-income-statement'

interface TokenIncomeStatementSectionProps {
	tokenSymbol: string
	incomeStatement: IProtocolOverviewPageData['incomeStatement'] | null | undefined
}

export function TokenIncomeStatementSection({ tokenSymbol, incomeStatement }: TokenIncomeStatementSectionProps) {
	if (!incomeStatement?.data) return null
	const componentNames = incomeStatement.components?.map((component) => {
		if (component.protocolType === 'chain') return `${component.name} Chain`
		return component.name
	})
	const description = componentNames?.length ? `Include incomes from ${componentNames.join(', ')}` : undefined

	return (
		<IncomeStatement
			name={tokenSymbol}
			incomeStatement={incomeStatement}
			view="table"
			anchorId={TOKEN_INCOME_STATEMENT_SECTION_ID}
			titleClassName="scroll-mt-24 text-xl font-bold"
			description={description}
		/>
	)
}

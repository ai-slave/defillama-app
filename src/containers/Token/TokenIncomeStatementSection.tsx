import { IncomeStatement } from '~/containers/ProtocolOverview/IncomeStatement'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'

const TOKEN_INCOME_STATEMENT_SECTION_ID = 'token-income-statement'

interface TokenIncomeStatementSectionProps {
	tokenName: string
	incomeStatement: IProtocolOverviewPageData['incomeStatement'] | null | undefined
}

export function TokenIncomeStatementSection({ tokenName, incomeStatement }: TokenIncomeStatementSectionProps) {
	if (!incomeStatement?.data) return null

	return (
		<IncomeStatement
			name={tokenName}
			incomeStatement={incomeStatement}
			view="table"
			anchorId={TOKEN_INCOME_STATEMENT_SECTION_ID}
			titleClassName="scroll-mt-24 text-xl font-bold"
		/>
	)
}

import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'

type IncomeStatementComponents = NonNullable<IProtocolOverviewPageData['incomeStatement']>['components']

/** Names what a token's income statement sums; chains are labeled so they read apart from protocols. */
export function describeIncomeStatementComponents(components: IncomeStatementComponents): string | undefined {
	const names = components?.map((component) =>
		component.protocolType === 'chain' ? `${component.name} Chain` : component.name
	)
	return names?.length ? `Include incomes from ${names.join(', ')}` : undefined
}

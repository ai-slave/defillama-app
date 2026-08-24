import type { getTokenIncomeStatement } from '~/containers/ProtocolOverview/queries'
import type { ITokenRightsData } from '~/containers/TokenRights/types'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import type { TokenOverviewData } from './tokenOverview'
import type { TokenRiskResponse } from './tokenRisk.types'

export type TokenIncomeStatementData = NonNullable<Awaited<ReturnType<typeof getTokenIncomeStatement>>>

// Borrow routes for the token page's two tabs: rows where the page token is the
// collateral leg ('Use X') vs the borrow leg ('Borrow X'). Flat RouteTableRow shape
// shared with /yields/borrow routes mode (Tables/Borrow).
export type TokenBorrowRoutesData = {
	useAsCollateral: RouteTableRow[]
	borrowThis: RouteTableRow[]
}

export type TokenBorrowRoutesCounts = {
	useAsCollateral: number
	borrowThis: number
}

export type TokenBorrowRoutesChainLists = {
	useAsCollateral: string[]
	borrowThis: string[]
}

export type TokenYieldsHydration = {
	rows: IYieldTableRow[]
	rowCount: number
	chainList: string[]
	pageSize: number
	// Resolved token option keys the client re-fetches full data with.
	tokenKeys: string[]
}

export type TokenBorrowRoutesHydration = {
	data: TokenBorrowRoutesData
	counts: TokenBorrowRoutesCounts
	chainLists: TokenBorrowRoutesChainLists
	pageSize: number
	// Resolved token option keys the client re-fetches full data with.
	tokenKeys: string[]
}

export type TokenIssuer = {
	name: string
	slug: string
}

export type TokenPageSection =
	| {
			id: 'token-overview'
			label: 'Overview'
			overview: TokenOverviewData
			geckoId: string | null
			logo: string | null
			issuer: TokenIssuer | null
	  }
	| {
			id: 'token-markets'
			label: 'Markets'
			geckoId: string
			tokenSymbol: string
	  }
	| {
			id: 'token-income-statement'
			label: 'Income Statement'
			tokenSymbol: string
			incomeStatement: TokenIncomeStatementData
	  }
	| {
			id: 'token-risks'
			label: 'Risks'
			tokenSymbol: string
			riskData: TokenRiskResponse
	  }
	| {
			id: 'token-rights-and-value-accrual'
			label: 'Token Rights'
			name: string
			symbol: string
			tokenRightsData: ITokenRightsData
	  }
	| {
			id: 'token-usage'
			label: 'Token Usage'
			tokenSymbol: string
	  }
	| {
			id: 'token-liquidations'
			label: 'Liquidations'
			tokenSymbol: string
	  }
	| {
			id: 'token-unlocks'
			label: 'Unlocks'
			resolvedUnlocksSlug: string
	  }
	| {
			id: 'token-yields'
			label: 'Yields'
			tokenSymbol: string
			hydration: TokenYieldsHydration
	  }
	| {
			id: 'token-borrow'
			label: 'Borrow'
			tokenSymbol: string
			hydration: TokenBorrowRoutesHydration
	  }

export type TokenPageSectionId = TokenPageSection['id']

export type TokenPageProps = {
	seoTitle: string
	seoDescription: string
	canonicalUrl: string
	sections: TokenPageSection[]
}

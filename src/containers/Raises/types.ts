import type { Raise } from './model'

export interface IRaisesFilters {
	investors: string[]
	rounds: string[]
	sectors: string[]
	chains: string[]
}

export interface IRaisesPageData extends IRaisesFilters {
	raises: Raise[]
	investorName: string | null
}

export interface IInvestorRaisesPageData extends IRaisesFilters {
	raises: Raise[]
	investorName: string
}

export interface IInvestorTimespan {
	topCategory: string | null
	topRound: string | null
	deals: number
	projects: string
	chains: string[]
	medianAmountUsd: number
}

export interface IInvestor {
	name: string
	last30d: IInvestorTimespan
	last180d: IInvestorTimespan
	last1y: IInvestorTimespan
	allTime: IInvestorTimespan
}

export interface IInvestorsPageData {
	investors: IInvestor[]
}

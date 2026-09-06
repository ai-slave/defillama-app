import type { Raise } from './model'

export interface IRaisesFilters {
	investors: Array<string>
	rounds: Array<string>
	sectors: Array<string>
	chains: Array<string>
}

export interface IRaisesPageData extends IRaisesFilters {
	raises: Array<Raise>
	investorName: string | null
}

export interface IInvestorRaisesPageData extends IRaisesFilters {
	raises: Array<Raise>
	investorName: string
}

export interface IInvestorTimespan {
	topCategory: string | null
	topRound: string | null
	deals: number
	projects: string
	chains: Array<string>
	medianAmountUsd: number | null
}

export interface IInvestor {
	name: string
	last30d: IInvestorTimespan
	last180d: IInvestorTimespan
	last1y: IInvestorTimespan
	allTime: IInvestorTimespan
}

export interface IInvestorsPageData {
	investors: Array<IInvestor>
}

export type TreasuryTokenBreakdowns = {
	ownTokens: number
	stablecoins: number
	majors: number
	others: number
}

export interface ITreasuryRow {
	name: string
	logo: string
	protocolHref: string | null
	tokenBreakdowns: TreasuryTokenBreakdowns
	coreTvl: number
	totalTvl: number
	mcap: number | null
}

export interface INetProjectTreasury {
	name: string
	logo: string
	slug: string
	netTreasury: number
}

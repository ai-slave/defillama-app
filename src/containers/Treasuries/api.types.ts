export interface RawTreasuryProtocol {
	id: string
	name: string
	logo: string
	slug: string
	tvl: number
	chainTvls: Record<string, number>
	tokenBreakdowns: {
		ownTokens: number
		stablecoins: number
		majors: number
		others: number
	}
	mcap: number | null
}

export type RawTreasuriesResponse = Array<RawTreasuryProtocol>

export type RawEntitiesResponse = Array<RawTreasuryProtocol>

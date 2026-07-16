/** Full protocol data from PROTOCOL_API/:slug */
export interface IProtocolDetailApiItem {
	name: string
	logo: string
	mcap: number | null
	chainTvls: Record<
		string,
		{
			tokens?: Array<{ date: number; tokens: Record<string, number> }>
			tokensInUsd?: Array<{ date: number; tokens: Record<string, number> }>
		}
	>
}

/** V2 earn pool fields consumed by the LST page. */
export interface IYieldPoolApiItem {
	project: string
	chain: string
	symbol: string
	apy: number | null
}

/** Legacy LST metadata from the yields lsdRates endpoint. */
export interface ILsdRateApiItem {
	name: string
	symbol: string | null
	type: 'rebase' | 'accruing' | null
	ethPeg: number | null
	marketRate: number | null
	expectedRate: number | null
	fee: number | null
}

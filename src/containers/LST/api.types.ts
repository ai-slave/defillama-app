/** Full protocol data from PROTOCOL_API/:slug */
export interface IProtocolDetailApiItem {
	name: string
	logo: string | null
	mcap: number | null
	chainTvls: Record<
		string,
		{
			tokens: Array<{ date: number; tokens: Record<string, number> }>
			tokensInUsd: Array<{ date: number; tokens: Record<string, number> }>
		}
	>
}

/** V2 earn pool fields consumed by the LST page. */
export interface IYieldPoolApiItem {
	project: string
	chain: string
	symbol: string
	apy: number | null
	tvlUsd: number | null
}

/** LST metadata from the lstRates endpoint. */
interface ILsdRateApiItemBase {
	name: string | null
	symbol: string | null
	address: string
	type: 'rebase' | 'accruing' | null
	fee: number | null
}

export type ILsdRateApiItem = ILsdRateApiItemBase &
	(
		| { ethPeg: number; marketRate: number; expectedRate: number }
		| { ethPeg: null; marketRate: number | null; expectedRate: number | null }
	)

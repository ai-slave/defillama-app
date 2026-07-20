type ProtocolLiteTvlEntry = {
	tvl: number
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

/** Raw protocol from the lite/protocols2 API. */
export interface ProtocolLite {
	name: string
	slug?: string
	id?: string
	symbol: string
	logo: string
	url: string
	category: string
	tags?: string[]
	referralUrl?: string | null
	chains: string[]
	chainTvls: Record<string, ProtocolLiteTvlEntry>
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	mcap: number | null
	defillamaId: string
	geckoId?: string | null
	parentProtocol?: string
	listedAt?: number
	deprecated?: boolean
	misrepresentedTokens?: boolean
	forkedFrom?: string[]
	oracles?: string[]
	oraclesByChain?: Record<string, string[]>
}

/** Raw parent protocol from the lite/protocols2 API. */
export interface ParentProtocolLite {
	id: string
	name: string
	symbol?: string
	chains: string[]
	gecko_id?: string | null
	mcap?: number | null
	referralUrl?: string | null
	logo?: string
}

/** Full response from lite/protocols2. */
export interface ProtocolsResponse {
	protocols: ProtocolLite[]
	chains: string[]
	parentProtocols: ParentProtocolLite[]
	protocolCategories?: string[]
}

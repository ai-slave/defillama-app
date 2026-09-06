export type ProtocolLiteTvlEntry = {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

export const PROTOCOL_LIST_ADDITIVE_TVL_KEYS = ['pool2', 'staking', 'borrowed', 'vesting'] as const

export type ProtocolListAdditiveTvlKey = (typeof PROTOCOL_LIST_ADDITIVE_TVL_KEYS)[number]

export function isProtocolListTvlKey(value: string): value is ProtocolListAdditiveTvlKey {
	return PROTOCOL_LIST_ADDITIVE_TVL_KEYS.some((key) => key === value)
}

/** Raw protocol from the lite/protocols2 API. */
export interface ProtocolLite {
	name: string
	symbol: string
	logo: string | null
	url: string
	referralUrl?: string
	chains: Array<string>
	chainTvls: Record<string, ProtocolLiteTvlEntry>
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	mcap: number | null
	defillamaId: string
	geckoId: string | null
	category: string
	tags?: Array<string>
	parentProtocol?: string
	listedAt?: number
	deprecated?: true
	forkedFrom?: Array<string>
}

/** Raw parent protocol from the lite/protocols2 API. */
export interface ParentProtocolLite {
	id: string
	name: string
	symbol?: string | null
	chains: Array<string>
	gecko_id: string | null
	mcap: number | null
	referralUrl?: string
	logo: string
	deprecated?: true
}

/** Full response from lite/protocols2. */
export interface ProtocolsResponse {
	protocols: Array<ProtocolLite>
	chains: Array<string>
	parentProtocols: Array<ParentProtocolLite>
	protocolCategories: Array<string>
}

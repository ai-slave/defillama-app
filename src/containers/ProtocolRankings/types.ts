import type { ProtocolListAdditiveTvlKey } from '~/containers/ProtocolLists/api.types'

export type TVL_TYPES = ProtocolListAdditiveTvlKey | 'doublecounted' | 'liquidstaking' | 'default' | 'excludeParent'

export type ProtocolRankingTvlEntry = {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

export type ProtocolRankingTvls = Partial<Record<TVL_TYPES, ProtocolRankingTvlEntry>> & {
	default: ProtocolRankingTvlEntry
}

export type ProtocolRankingActivityMetric = {
	total24h: number | null
	total7d: number | null
	total30d: number | null
	totalAllTime: number | null
	change_7dover7d: number | null
}

export interface IChildProtocol {
	/** Canonical DefiLlama protocol or parent-protocol id. */
	id?: string
	name: string
	slug: string
	logo?: string | null
	category: string | null
	tvl: ProtocolRankingTvls | null
	tvlChange: {
		change1d: number | null
		change7d: number | null
		change1m: number | null
	} | null
	chains: Array<string>
	mcap: number | null
	tokenPrice: number | null
	mcaptvl: number | null
	strikeTvl: boolean
	fees?: {
		total24h: number | null
		total7d: number | null
		total30d: number | null
		total1y: number | null
		annualized1y: number | null
		monthlyAverage1y: number | null
		totalAllTime: number | null
		pf: number | null
	}
	revenue?: {
		total24h: number | null
		total7d: number | null
		total30d: number | null
		total1y: number | null
		annualized1y: number | null
		monthlyAverage1y: number | null
		totalAllTime: number | null
		ps: number | null
	}
	holdersRevenue?: {
		total24h: number | null
		total7d: number | null
		total30d: number | null
		total1y: number | null
		monthlyAverage1y: number | null
		totalAllTime: number | null
	}
	dexs?: ProtocolRankingActivityMetric
	perps?: ProtocolRankingActivityMetric
	normalizedVolume?: ProtocolRankingActivityMetric
	activeLiquidity?: ProtocolRankingActivityMetric
	openInterest?: ProtocolRankingActivityMetric
	optionsPremiumVolume?: ProtocolRankingActivityMetric
	optionsNotionalVolume?: ProtocolRankingActivityMetric
	dexAggregators?: ProtocolRankingActivityMetric
	perpsAggregators?: ProtocolRankingActivityMetric
	bridgeAggregators?: ProtocolRankingActivityMetric
	emissions?: {
		total24h: number | null
		total7d: number | null
		total30d: number | null
		total1y: number | null
		monthlyAverage1y: number | null
		totalAllTime: number | null
	}
	deprecated?: boolean
}

export interface IProtocol extends IChildProtocol {
	childProtocols?: Array<IChildProtocol>
}

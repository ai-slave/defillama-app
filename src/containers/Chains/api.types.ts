export interface ChainListItem {
	name: string
	tvl: number
	gecko_id: string | null
	tokenSymbol: string | null
	cmcId: string | null
	chainId: number | string | null
}

export interface ChainsCategoriesResponse {
	categories: Array<string>
}

export interface ChainExtraTvlSnapshot {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

/** Adapter-defined snapshot families are dynamic and must retain their original key identity. */
export type ChainExtraTvlRecord = Record<string, ChainExtraTvlSnapshot>

export interface ChainsByCategoryChain {
	name: string
	symbol: string
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	mcap: number | null
	mcaptvl: number | null
	protocols?: number | null
	extraTvl: ChainExtraTvlRecord
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	deprecated?: boolean
}

export interface ChainsByCategoryResponse {
	chainsUnique: Array<string>
	categories: Array<string>
	chainTvls: Array<ChainsByCategoryChain>
	chainsGroupbyParent: Record<string, Record<string, Array<string>>>
	stackedDataset: Array<[string, Record<string, Record<string, number>>]>
	tvlTypes: Record<string, string>
}

export type ChainChartPoint = [timestamp: string | number, value: number]

export interface ChainChartResponse {
	tvl: Array<ChainChartPoint>
	staking?: Array<ChainChartPoint>
	borrowed?: Array<ChainChartPoint>
	pool2?: Array<ChainChartPoint>
	vesting?: Array<ChainChartPoint>
	offers?: Array<ChainChartPoint>
	doublecounted?: Array<ChainChartPoint>
	liquidstaking?: Array<ChainChartPoint>
	dcAndLsOverlap?: Array<ChainChartPoint>
	/** Adapter-defined TVL sections are forwarded by the API alongside the known sections above. */
	[section: string]: Array<ChainChartPoint> | undefined
}

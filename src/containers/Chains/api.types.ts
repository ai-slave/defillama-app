export interface ChainListItem {
	name: string
	tvl: number
	gecko_id: string | null
	tokenSymbol: string | null
	cmcId: string | null
	chainId: number | string | null
	[key: string]: unknown
}

export interface ChainsCategoriesResponse {
	categories: string[]
}

export interface ChainsByCategoryResponse {
	chainsUnique: string[]
	categories: string[]
	chainTvls: Array<{
		name: string
		extraTvl?: Record<string, { tvl?: number }>
		[key: string]: unknown
	}>
	chainsGroupbyParent: Record<string, Record<string, string[]>>
	stackedDataset: Array<[string, Record<string, Record<string, number>>]>
	tvlTypes: Record<string, string>
	[key: string]: unknown
}

export type ChainChartPoint = [timestamp: string | number, value: number]

export interface ChainChartResponse {
	tvl: ChainChartPoint[]
	staking?: ChainChartPoint[]
	borrowed?: ChainChartPoint[]
	pool2?: ChainChartPoint[]
	vesting?: ChainChartPoint[]
	offers?: ChainChartPoint[]
	doublecounted?: ChainChartPoint[]
	liquidstaking?: ChainChartPoint[]
	dcAndLsOverlap?: ChainChartPoint[]
	/** Adapter-defined TVL sections are forwarded by the API alongside the known sections above. */
	[section: string]: ChainChartPoint[] | undefined
}

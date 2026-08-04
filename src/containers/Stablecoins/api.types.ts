export type StablecoinPegType =
	| 'peggedUSD'
	| 'peggedVAR'
	| 'peggedEUR'
	| 'peggedSGD'
	| 'peggedJPY'
	| 'peggedCNY'
	| 'peggedMXN'
	| 'peggedMYR'
	| 'peggedUAH'
	| 'peggedARS'
	| 'peggedGBP'
	| 'peggedCAD'
	| 'peggedTRY'
	| 'peggedCHF'
	| 'peggedCOP'
	| 'peggedREAL'
	| 'peggedRUB'
	| 'peggedAUD'
	| 'peggedKES'
	| 'peggedZAR'
	| 'peggedNGN'
	| 'peggedXOF'
	| 'peggedGHS'
	| 'peggedCLP'
	| 'peggedPEN'
	| 'peggedPHP'
	| 'peggedKRW'

export type StablecoinPegMechanism = 'algorithmic' | 'fiat-backed' | 'crypto-backed'
export type RawStablecoinPegMechanism = StablecoinPegMechanism | 'crytpo-backed'

export type StablecoinPriceSource =
	| 'chainlink'
	| 'uniswap'
	| 'dexscreener'
	| 'curve'
	| 'coingecko'
	| 'birdeye'
	| 'kucoin'
	| 'defillama'
	| 'kaddex'

export type StablecoinPegBalances = Partial<Record<StablecoinPegType, number>>
export type StablecoinNullablePegBalances = Partial<Record<StablecoinPegType, number | null>>

export interface StablecoinsListResponse {
	peggedAssets: StablecoinListAsset[]
	chains: StablecoinListChain[]
}

export interface RawStablecoinsListResponse {
	peggedAssets: RawStablecoinListAsset[]
	chains: StablecoinListChain[]
}

export interface StablecoinListAsset {
	id: string
	name: string
	symbol: string
	gecko_id: string | null
	chains: string[]
	pegType: StablecoinPegType
	pegMechanism: StablecoinPegMechanism
	priceSource?: StablecoinPriceSource | null
	price: number | null
	circulating: StablecoinPegBalances
	circulatingPrevDay: StablecoinPegBalances
	circulatingPrevWeek: StablecoinPegBalances
	circulatingPrevMonth: StablecoinPegBalances
	chainCirculating: Record<
		string,
		{
			current: StablecoinPegBalances
			circulatingPrevDay: StablecoinPegBalances
			circulatingPrevWeek: StablecoinPegBalances
			circulatingPrevMonth: StablecoinPegBalances
		}
	>
	deprecated?: true
	delisted?: true
	deadFrom?: string
	yieldBearing?: true
}

export type RawStablecoinListAsset = Omit<StablecoinListAsset, 'pegMechanism'> & {
	pegMechanism: RawStablecoinPegMechanism
}

export interface StablecoinListChain {
	name: string
	totalCirculatingUSD: StablecoinPegBalances
}

interface RawStablecoinBridgeConfig {
	lzConfig?: {
		symbols?: string[]
		excludeChains?: string[]
		oftTypes?: string[]
		chainMap?: Record<string, string>
		requirePeggedToSource?: boolean
	}
	hyperlaneConfig?: {
		symbols?: string[]
		excludeChains?: string[]
		standardTypes?: string[]
		chainMap?: Record<string, string>
		sourceChain?: string
	}
}

interface RawStablecoinChainConfig {
	decimals?: number
	chains: Record<string, Record<string, string | string[]>>
}

export interface RawStablecoinDetailResponse {
	id: string
	name: string
	address: string | null
	symbol: string
	url: string
	description: string
	mintRedeemDescription: string
	onCoinGecko: string | boolean
	gecko_id: string | null
	cmcId: string | number | null
	pegType: StablecoinPegType
	pegMechanism: RawStablecoinPegMechanism
	priceSource?: StablecoinPriceSource | null
	auditLinks?: string[] | string | null
	twitter: string | null
	wiki?: string | null
	price: number | null
	module?: string
	deprecated?: true
	delisted?: true
	yieldBearing?: true
	doublecounted?: true
	deadFrom?: string
	deadUrl?: boolean
	coin_icon?: string
	bridgeConfig?: RawStablecoinBridgeConfig
	chainConfig?: RawStablecoinChainConfig
	tokens: StablecoinDetailToken[]
	chainBalances: Record<string, { tokens: StablecoinChainBalanceToken[] }>
	currentChainBalances: Record<string, StablecoinNullablePegBalances>
}

export interface StablecoinDetailResponse {
	id: string
	name: string
	address: string | null
	symbol: string
	url: string
	description: string
	mintRedeemDescription: string
	onCoinGecko: boolean
	gecko_id: string | null
	cmcId: string | number | null
	pegType: StablecoinPegType
	pegMechanism: StablecoinPegMechanism
	priceSource: StablecoinPriceSource | null
	auditLinks: string[] | null
	twitter: string | null
	wiki: string | null
	price: number | null
	module: string | null
	deprecated?: true
	delisted?: true
	yieldBearing?: true
	doublecounted?: true
	deadFrom?: string
	tokens: StablecoinDetailToken[]
	chainBalances: Record<string, { tokens: StablecoinChainBalanceToken[] }>
	currentChainBalances: Record<string, StablecoinNullablePegBalances>
}

export type StablecoinRawBridgeAmount = number | `${number}`
export type StablecoinLegacyBridgeValue = { source: string; amount?: StablecoinRawBridgeAmount }
export type StablecoinBridgeSourceAmounts = Record<string, { amount: StablecoinRawBridgeAmount }> & {
	source?: never
	amount?: never
}
export type StablecoinRawBridgeBreakdown = Record<
	string,
	number | StablecoinLegacyBridgeValue | StablecoinBridgeSourceAmounts
>

export type StablecoinIssuanceBalances = StablecoinNullablePegBalances & {
	bridges?: StablecoinRawBridgeBreakdown
}

export type StablecoinDetailIssuanceAmount = 0 | StablecoinIssuanceBalances

export interface StablecoinDetailToken {
	date: number
	circulating?: StablecoinDetailIssuanceAmount
	unreleased?: StablecoinDetailIssuanceAmount
	minted?: StablecoinDetailIssuanceAmount
	bridgedTo?: StablecoinDetailIssuanceAmount
}

export type StablecoinChainBalanceToken = StablecoinDetailToken

export interface StablecoinChartResponse {
	aggregated: StablecoinChartPoint[]
	breakdown: Record<string, StablecoinChartPoint[]>
	/** IDs refer to `StablecoinListAsset.id`. */
	doublecountedIds: string[]
}

export type StablecoinVolumeGlobalChartKind = 'total' | 'chain' | 'token' | 'currency'
export type StablecoinVolumeChainChartKind = 'total' | 'token' | 'currency'
export type StablecoinVolumeTokenChartKind = 'total' | 'chain'
export type StablecoinVolumeChartKind = StablecoinVolumeGlobalChartKind

export type StablecoinVolumeTotalChartPoint = [timestamp: number, volume: number]
export type StablecoinVolumeBreakdownChartPoint = [timestamp: number, breakdown: Record<string, number>]

export type StablecoinVolumeChartResponse = StablecoinVolumeTotalChartPoint[] | StablecoinVolumeBreakdownChartPoint[]

export type StablecoinVolumeChartResponseFor<TChart extends StablecoinVolumeChartKind> = TChart extends 'total'
	? StablecoinVolumeTotalChartPoint[]
	: StablecoinVolumeBreakdownChartPoint[]

export interface StablecoinChartPoint {
	date: string
	totalCirculatingUSD?: StablecoinPegBalances
	totalCirculating?: StablecoinPegBalances
	totalUnreleased?: StablecoinPegBalances
	totalBridgedToUSD?: StablecoinPegBalances
	totalMintedUSD?: StablecoinPegBalances
}

export interface StablecoinDominanceResponse {
	dominanceMap: Record<string, StablecoinDominanceEntry[]>
	chainChartMap: Record<string, StablecoinDominanceChartPoint[]>
}

export interface StablecoinDominanceEntry {
	date: string
	totalCirculatingUSD: StablecoinPegBalances
	greatestMcap?: {
		gecko_id: string | null
		symbol: string
		mcap: number
	}
}

export type StablecoinDominanceChartPoint = StablecoinChartPoint

export type StablecoinRecentCoinsDataResponse = Record<string, StablecoinRecentCoinDataPoint[]>
export type StablecoinRecentCoinDataPoint = StablecoinChartPoint

export interface RawStablecoinPriceSnapshot {
	date: number
	prices: Record<string, string | number>
}

export type RawStablecoinPricesResponse = RawStablecoinPriceSnapshot[]

export interface StablecoinPriceSnapshot {
	date: number
	prices: Record<string, number>
}

export type StablecoinPricesResponse = StablecoinPriceSnapshot[]

export interface StablecoinRateSnapshot {
	date: number
	rates: Record<string, number>
}

export type StablecoinRatesResponse = StablecoinRateSnapshot[]

export type StablecoinConfigResponse = Record<string, string>

export interface StablecoinBridgeInfo {
	name: string
	link?: string
}

export type StablecoinBridgeInfoResponse = Record<string, StablecoinBridgeInfo>

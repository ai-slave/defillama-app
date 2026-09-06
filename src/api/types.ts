export interface IChainTvl {
	[type: string]: {
		tvl: Array<{ date: number; totalLiquidityUSD: number }>
		tokensInUsd?: Array<{ date: number; tokens: { [token: string]: number } }>
		tokens?: Array<{ date: number; tokens: { [token: string]: number } }>
	}
}

export interface LlamaConfigResponse {
	protocols: Array<LlamaConfigProtocol>
	parentProtocols: Array<LlamaConfigParentProtocol>
	chainCoingeckoIds: Record<string, LlamaChainConfig>
	treasuries: Array<LlamaConfigProtocol>
	entities: Array<LlamaConfigEntity>
	chainKeyToLabelMap: Record<string, string>
}

interface LlamaConfigBaseProtocol {
	id: string
	name: string
	address?: string | null
	symbol?: string
	url?: string
	referralUrl?: string
	description?: string | null
	chain?: string
	logo?: string
	audits?: string | null
	gecko_id?: string | null
	cmcId?: string | null
	category?: string
	chains?: Array<string>
	module?: string
	twitter?: string | null
	audit_links?: Array<string>
	github?: Array<string>
	stablecoins?: Array<string>
	warningBanners?: Array<LlamaConfigWarningBanner>
	deadUrl?: boolean
	deprecated?: boolean
	rugged?: boolean
	wrongLiquidity?: boolean
}

interface LlamaConfigProtocol extends LlamaConfigBaseProtocol {
	category: string
	chain: string
	chains: Array<string>
	module: string
	misrepresentedTokens?: boolean
	tvlCodePath?: string | null
	parentProtocol?: string
	treasury?: string | null
	dimensions?: LlamaConfigDimensions
	tags?: Array<string>
	methodology?: string
	language?: string
	hallmarks?: Array<[number, string]>
	tokensExcludedFromParent?: Record<string, Array<string>>
	previousNames?: Array<string>
	forkedFrom?: Array<string>
	forkedFromIds?: Array<string>
	oracles?: Array<string>
	oraclesBreakdown?: Array<LlamaConfigOracleBreakdown>
	assetToken?: string
	openSource?: boolean
	listedAt?: number
	excludeTvlFromParent?: boolean
	deadFrom?: string
}

interface LlamaConfigParentProtocol extends LlamaConfigBaseProtocol {
	url: string
	description: string
	logo: string
	chains: Array<string>
	treasury?: string
}

interface LlamaConfigEntity extends LlamaConfigBaseProtocol {
	url: string
	description: string
	logo: string
	category: string
	module: string
	symbol: string
	chain: string
	gecko_id: null
	cmcId: null
	chains: Array<string>
	misrepresentedTokens: boolean
	tvlCodePath: string
}

interface LlamaChainConfig {
	geckoId?: string | null
	symbol?: string | null
	cmcId?: string | null
	categories?: Array<string> | null
	chainId?: number | string
	chainid?: number
	github?: Array<string> | null
	twitter?: string | null
	url?: string | null
	dimensions?: LlamaConfigDimensions
	deadUrl?: boolean
	stablecoins?: Array<string>
	warningBanners?: Array<LlamaConfigWarningBanner>
	parent?: {
		chain: string
		types: Array<string>
		da?: string
	}
}

type LlamaConfigDimensions = Record<string, string | LlamaConfigDimensionConfig>

interface LlamaConfigDimensionConfig {
	adapter?: string
	defaultChartView?: string
	genuineSpikes?: Array<[string, string]>
}

interface LlamaConfigWarningBanner {
	message: string
	level: 'low' | 'alert' | 'rug'
	until?: number | string
}

interface LlamaConfigOracleBreakdown {
	name: string
	type: string
	proof: Array<string>
}

export interface PriceObject {
	confidence: number
	decimals?: number
	price: number
	symbol: string
	timestamp: number
}

export interface CoinsPricesResponse {
	coins?: Record<string, PriceObject>
}

interface CoinChartPricePoint {
	timestamp: number
	price: number
}

interface CoinChartEntry {
	prices?: Array<CoinChartPricePoint>
}

export interface CoinsChartResponse {
	coins?: Record<string, CoinChartEntry | undefined>
}

export interface SearchQuery {
	indexUid: string
	limit: number
	offset: number
	q: string
	filter?: Array<string | Array<string>>
	sort?: Array<string>
}

interface BlockExplorerLink {
	name: string
	url: string
}

export interface BlockExplorersChain {
	displayName: string
	llamaChainId: string | null
	evmChainId: number | null
	blockExplorers: Array<BlockExplorerLink>
}

export type BlockExplorersResponse = Array<BlockExplorersChain>

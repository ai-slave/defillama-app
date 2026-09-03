export interface IChainTvl {
	[type: string]: {
		tvl: { date: number; totalLiquidityUSD: number }[]
		tokensInUsd?: Array<{ date: number; tokens: { [token: string]: number } }>
		tokens?: Array<{ date: number; tokens: { [token: string]: number } }>
	}
}

export interface LlamaConfigResponse {
	protocols: LlamaConfigProtocol[]
	parentProtocols: LlamaConfigParentProtocol[]
	chainCoingeckoIds: Record<string, LlamaChainConfig>
	treasuries: LlamaConfigProtocol[]
	entities: LlamaConfigEntity[]
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
	chains?: string[]
	module?: string
	twitter?: string | null
	audit_links?: string[]
	github?: string[]
	governanceID?: string[]
	stablecoins?: string[]
	warningBanners?: LlamaConfigWarningBanner[]
	deadUrl?: boolean
	deprecated?: boolean
	rugged?: boolean
	wrongLiquidity?: boolean
}

interface LlamaConfigProtocol extends LlamaConfigBaseProtocol {
	category: string
	chain: string
	chains: string[]
	module: string
	misrepresentedTokens?: boolean
	tvlCodePath?: string | null
	parentProtocol?: string
	treasury?: string | null
	dimensions?: LlamaConfigDimensions
	tags?: string[]
	methodology?: string
	language?: string
	hallmarks?: Array<[number, string]>
	tokensExcludedFromParent?: Record<string, string[]>
	previousNames?: string[]
	forkedFrom?: string[]
	forkedFromIds?: string[]
	oracles?: string[]
	oraclesBreakdown?: LlamaConfigOracleBreakdown[]
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
	chains: string[]
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
	chains: string[]
	misrepresentedTokens: boolean
	tvlCodePath: string
}

interface LlamaChainConfig {
	geckoId?: string | null
	symbol?: string | null
	cmcId?: string | null
	categories?: string[] | null
	chainId?: number | string
	chainid?: number
	github?: string[] | null
	governanceID?: string[]
	twitter?: string | null
	url?: string | null
	dimensions?: LlamaConfigDimensions
	deadUrl?: boolean
	stablecoins?: string[]
	warningBanners?: LlamaConfigWarningBanner[]
	parent?: {
		chain: string
		types: string[]
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
	proof: string[]
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
	prices?: CoinChartPricePoint[]
}

export interface CoinsChartResponse {
	coins?: Record<string, CoinChartEntry | undefined>
}

export interface SearchQuery {
	indexUid: string
	limit: number
	offset: number
	q: string
	filter?: Array<string | string[]>
	sort?: string[]
}

interface BlockExplorerLink {
	name: string
	url: string
}

export interface BlockExplorersChain {
	displayName: string
	llamaChainId: string | null
	evmChainId: number | null
	blockExplorers: BlockExplorerLink[]
}

export type BlockExplorersResponse = BlockExplorersChain[]

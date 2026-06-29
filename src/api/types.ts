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
	coins?: Record<string, PriceObject | undefined>
}

interface CoinChartPricePoint {
	timestamp?: number
	price?: number
}

interface CoinChartEntry {
	prices?: CoinChartPricePoint[]
}

export interface CoinsChartResponse {
	coins?: Record<string, CoinChartEntry | undefined>
}

interface LlamaswapChain {
	chain: string
	chainId: number
	address: string
	priceImpact: number
	liquidity?: number
}

interface ProtocolLlamaswapEntry {
	name: string
	slug: string
	symbol: string
	geckoId: string
	chains?: Array<LlamaswapChain>
	updatedAt?: string
}

export type ProtocolLlamaswapDataset = Record<string, ProtocolLlamaswapEntry>

/** Single pool row for a token from `LIQUIDITY_API` (`/liquidity.json`). */
interface ProtocolLiquidityTokenPool {
	chain: string
	project: string
	symbol: string
	tvlUsd: number
	pool?: string
	apy?: number | null
	apyBase?: number | null
	apyReward?: number | null
	rewardTokens?: string[] | null
	apyPct1D?: number | null
	apyPct7D?: number | null
	apyPct30D?: number | null
	stablecoin?: boolean
	ilRisk?: string
	exposure?: string
	poolMeta?: string | null
	predictions?: {
		predictedClass?: string
		predictedProbability?: number
		binnedConfidence?: number
	}
	mu?: number
	sigma?: number
	count?: number
	outlier?: boolean
	underlyingTokens?: string[]
	il7d?: number | null
	apyBase7d?: number | null
	apyMean30d?: number | null
	volumeUsd1d?: number | null
	volumeUsd7d?: number | null
	apyBaseInception?: number | null
	[key: string]: unknown
}

/** One token’s liquidity coverage from the datasets `liquidity.json` list. */
interface ProtocolLiquidityToken {
	id: string
	symbol?: string
	tokenPools?: ProtocolLiquidityTokenPool[]
	[key: string]: unknown
}

/** Response body of `LIQUIDITY_API`: array of tokens with pool-level liquidity. */
export type ProtocolLiquidityTokensResponse = ProtocolLiquidityToken[]

export type ProtocolTokenLiquidityChart = Array<[string | number, number]>

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

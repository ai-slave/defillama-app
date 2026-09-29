export interface IChainMetadata {
	stablecoins?: boolean
	dexs?: boolean
	dexsNotionalVolume?: boolean
	name: string
	activeLiquidity?: boolean
	fees?: boolean
	revenue?: boolean
	chainFees?: boolean
	chainRevenue?: boolean
	chainHoldersRevenue?: boolean
	perps?: boolean
	openInterest?: boolean
	normalizedVolume?: boolean
	dexAggregators?: boolean
	optionsPremiumVolume?: boolean
	optionsNotionalVolume?: boolean
	perpsAggregators?: boolean
	bridgeAggregators?: boolean
	inflows?: boolean
	chainAssets?: boolean
	gecko_id?: string
	gasTokenGeckoId?: string | null
	gasTokenSymbol?: string | null
	tokenSymbol?: string | null
	github?: boolean
	id: string
	protocolCount?: number
	deprecated?: boolean
	incentives?: boolean
	chainActiveUsers?: boolean
	chainNewUsers?: boolean
	activeUsers?: boolean
	newUsers?: boolean
	txCount?: boolean
	gasUsed?: boolean
	dimAgg?: Record<string, Record<string, { '24h'?: number | null; '7d'?: number | null; '30d'?: number | null }>>
}

export interface IProtocolMetadata {
	name?: string
	previousNames?: Array<string>
	category?: string
	parentProtocol?: string
	tvl?: boolean
	yields?: boolean
	forks?: boolean
	liquidity?: boolean
	raises?: boolean
	fees?: boolean
	revenue?: boolean
	holdersRevenue?: boolean
	dexs?: boolean
	dexsNotionalVolume?: boolean
	perps?: boolean
	// Perp and other non-options open interest; options open interest is optionsOpenInterest.
	openInterest?: boolean
	normalizedVolume?: boolean
	dexAggregators?: boolean
	optionsPremiumVolume?: boolean
	optionsNotionalVolume?: boolean
	optionsOpenInterest?: boolean
	perpsAggregators?: boolean
	bridgeAggregators?: boolean
	deprecated?: boolean
	displayName?: string
	chains?: Array<string>
	hacks?: boolean
	expenses?: boolean
	treasury?: boolean
	emissions?: boolean
	incentives?: boolean
	bridge?: boolean
	stablecoins?: boolean
	safeHarbor?: boolean
	borrowed?: boolean
	tokenRights?: boolean
	inflows?: boolean
	activeUsers?: boolean
	newUsers?: boolean
	txCount?: boolean
	gasUsed?: boolean
	liquidationVolume?: boolean
	collateralLiquidated?: boolean
	gecko_id?: string
	cex?: boolean
	// Derived at metadata-build time from the RWA platforms index, not published by the
	// protocols API. Set when the RWA sheet declares this protocol via `*defillamaSlug`.
	rwaPlatformSlug?: string
	// Where a retired TVL page lands. Set for declared protocols AND the children of a declared
	// parent, so retiring a child's adapter redirects instead of 404ing. Never gates the RWA tab.
	rwaPlatformRedirectSlug?: string
	// This protocol's OWN issued RWA mcap slug, when the RWA sheet attributes assets to it.
	// Wins over rwaPlatformSlug for the AUM headline and chart: the platform aggregate covers
	// the whole parent book, which is wrong on a single-product child page.
	rwaProtocolMcapSlug?: string
	// Derived at metadata-build time from CRYPTO_CARD_ISSUER_PROTOCOL_IDS. The cards issuer whose
	// cards this protocol's Card Details page shows.
	cryptoCardIssuer?: string
	// Set on the children of a card-issuing host: they show the Card Details tab, and their card
	// page redirects to the host's, which lives at this slug.
	cryptoCardRedirectSlug?: string
}

export interface ICexItem {
	name: string
	slug?: string
	coin?: string | null
	coinSymbol?: string | null
	walletsLink?: string | null
	cgId?: string | null
	cgDeriv?: string | null
	lastAuditDate?: number
	auditor?: string | null
	auditLink?: string | null
}

export interface ICategoriesAndTagsConfig {
	category: string
	chains?: Array<string>
	slug?: string
	dimAgg?: Record<string, Record<string, { '24h'?: number | null; '7d'?: number | null; '30d'?: number | null }>>
	bridgeAggregators?: boolean
	dexAggregators?: boolean
	dexs?: boolean
	fees?: boolean
	normalizedVolume?: boolean
	openInterest?: boolean
	optionsNotionalVolume?: boolean
	optionsPremiumVolume?: boolean
	perps?: boolean
	perpsAggregators?: boolean
	revenue?: boolean
}

export interface ICategoriesAndTags {
	categories: Array<string>
	tags: Array<string>
	tagCategoryMap: Record<string, string>
	configs: Record<string, ICategoriesAndTagsConfig>
}

export interface IRWAList {
	canonicalMarketIds: Array<string>
	platforms: Array<string>
	platformRoutes?: Array<{ name: string; slug: string }>
	chains: Array<string>
	categories: Array<string>
	assetGroups: Array<string>
	idMap: Record<string, string>
}

export interface IRWAPerpsList {
	contracts: Array<string>
	venues: Array<string>
	categories: Array<string>
	assets: Array<string>
	assetGroups: Array<string>
	total: number
}

export interface ITokenListEntry {
	symbol: string
	current_price: number | null
	price_change_24h: number | null
	price_change_percentage_24h: number | null
	ath: number | null
	ath_date: string | null
	atl: number | null
	atl_date: string | null
	market_cap: number | null
	fully_diluted_valuation: number | null
	total_volume: number | null
	total_supply: number | null
	circulating_supply: number | null
	max_supply: number | null
}

export interface IEmissionsHistoricalPricePoint {
	timestamp: number
	price: number
}

export type IEmissionsHistoricalPrices = Record<string, { prices: Array<IEmissionsHistoricalPricePoint> }>

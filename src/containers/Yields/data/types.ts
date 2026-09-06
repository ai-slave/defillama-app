// Raw API row/envelope shapes served by the yields v2 API, plus the internal
// enriched row models this module builds on top of them. Field names mirror the
// API payloads verbatim; enrichment fields are camelCased app-side additions.

export type ApyWindow = 'current' | 'avg_7d' | 'avg_30d'
export type ApyComponent = 'base' | 'reward' | 'intrinsic'

export interface ApyTriple {
	base: number | null
	reward: number | null
	total: number | null
}

export type ApyWindows = Record<ApyWindow, ApyTriple>

export interface CompositionValues {
	base: number | null
	base_reward: number | null
	base_intrinsic: number | null
	base_reward_intrinsic: number | null
}

export interface IntrinsicApy {
	apy: Record<ApyWindow, { base: number | null }>
	source_pool: { id: string; pool_token: string | null; symbol: string | null }
}

export interface ResolvedApy {
	base: number | null
	reward: number | null
	intrinsic: number | null
	total: number | null
}

export interface Holders {
	count: number | null
	avg_position_usd: number | null
	top_10_share_pct: number | null
}

export interface Token {
	address: string
	symbol: string | null
	decimals: number | null
}

export interface PoolToken {
	address: string
	symbol: string | null
	name: string | null
}

interface TrendFields {
	id: string
	start_date: string
	end_date: string
	intrinsic?: Array<number | null>
}

// An unattributable total never appears alongside the component series.
export type Trend = TrendFields &
	(
		| { total: Array<number | null>; base?: never; reward?: never }
		| { base: Array<number | null>; reward?: Array<number | null>; total?: never }
	)

export interface TokenKeys {
	id: string
	pool_token?: Array<string>
	reference_asset?: Array<string>
	borrow_token?: Array<string>
	// Whole-set membership for the reference target: option keys the pool's ENTIRE
	// reference token set belongs to (the exact_any test). `reference_asset` above
	// only records options that *some* reference token belongs to, so strict Exact
	// matching consults this field instead. Absent when no option covers the whole set.
	reference_asset_exact?: Array<string>
}

export interface MetaChain {
	slug: string
	name: string
	is_evm: boolean
}

export interface MetaProtocol {
	slug: string
	name: string
	category: string | null
	has_audit: boolean
	has_token: boolean
}

export interface MetaCategory {
	slug: string
	name: string
}

export interface MetaTokenOption {
	value: string
	symbol: string
}

// Token option fed to the /yields token search, serialised as a compact
// `[name, value]` tuple to shrink the static page props (~4k options): `name` is
// the display symbol, `value` is the option key sent to the earn route as
// `token=<value>`.
export type TokenOption = [name: string, value: string]

export interface YieldsMeta {
	chains: Array<MetaChain>
	protocols: Array<MetaProtocol>
	categories: Array<MetaCategory>
	tokens: { families: Array<MetaTokenOption>; assets: Array<MetaTokenOption> }
	// Editorial halal whitelist, served as current protocol slugs (id-keyed at the source).
	halal: Array<string>
	// Pools involving warehouse-classified meme tokens — a UI-level classification
	// (default-hidden noise), served once here instead of as a per-row flag.
	meme_pool_ids: Array<string>
}

export interface EarnAttributes {
	stablecoin_only: boolean | null
	single_asset_exposure: boolean | null
	impermanent_loss_risk: boolean | null
}

// Worst-deviation-per-pool for pools holding a USD stablecoin off peg (>2%), served by
// /v2/depegs. `deviation_pct` is RELATIVE (−0.05 = −5%); kept relative through all plumbing
// and formatted only in cells. Sparse: only pools with a flagged token appear.
export interface DepegRow {
	pool_id: string
	deviation_pct: number
	token_symbol: string
}

export interface EarnRow {
	id: string
	pool_key: string
	pool_token: PoolToken | null
	display: { label: string | null; detail: string | null }
	reference_asset_symbol: string | null
	url: string | null
	protocol: string
	chain: string
	underlying_tokens: Array<Token>
	reward_tokens: Array<Token>
	tvl_usd: number | null
	apy: ApyWindows
	intrinsic: IntrinsicApy | null
	stability_30d: CompositionValues
	holders: Holders
	price_per_share: number | null
	volume_1d_usd: number | null
	attributes: EarnAttributes
	available_supply_usd: number | null
}

export interface BorrowMarketRow {
	id: string
	pool_key: string
	pool_token: PoolToken | null
	protocol: string
	chain: string
	display: { label: string | null; detail: string | null }
	url: string | null
	collateral_token: Token | null
	borrow_token: Token | null
	reward_tokens: Array<Token>
	loan_to_value: number | null
	total_supply_usd: number | null
	total_borrow_usd: number | null
	available_borrow_usd: number | null
	supply_apy: ApyWindows
	borrow_cost_apy: ApyWindows
	intrinsic: { supply: IntrinsicApy | null; borrow: IntrinsicApy | null }
}

export interface RouteLegCollateral {
	id: string
	pool_key: string
	url: string | null
	token: Token | null
	loan_to_value: number | null
	total_supply_usd: number | null
	apy: ApyWindows
	intrinsic: IntrinsicApy | null
	reward_tokens: Array<Token>
}

export interface RouteLegBorrow {
	id: string
	pool_key: string
	url: string | null
	token: Token | null
	total_borrow_usd: number | null
	available_borrow_usd: number | null
	cost_apy: ApyWindows
	intrinsic: IntrinsicApy | null
	reward_tokens: Array<Token>
}

export interface RouteRow {
	protocol: string
	chain: string
	display: { detail: string | null }
	collateral: RouteLegCollateral
	borrow: RouteLegBorrow
	net_apy: Record<ApyWindow, CompositionValues>
}

export interface LoopRow {
	id: string
	protocol: string
	chain: string
	display: { detail: string | null }
	token: Token | null
	url: string | null
	loan_to_value: number | null
	total_supply_usd: number | null
	total_borrow_usd: number | null
	available_borrow_usd: number | null
	supply_apy: ApyWindows
	borrow_cost_apy: ApyWindows
	loop_apy: { loop_count: number | null; total: number | null }
	leverage: { supply_multiplier: number | null; borrow_multiplier: number | null }
	intrinsic: IntrinsicApy | null
	// Per-leg reward tokens (supply/borrow) carried on the raw blob — surfaced as symbols for the
	// supply/borrow leg tooltips.
	reward_tokens: { supply: Array<Token>; borrow: Array<Token> }
}

// Entity facts joined on from /v2/meta (rows only carry plain name strings).
export interface EntityEnrichment {
	protocolSlug: string | null
	chainSlug: string | null
	isEvm: boolean | null
	category: string | null
	hasAudit: boolean
	protocolHasToken: boolean
}

export type EntityEarnRow = EarnRow & EntityEnrichment
export type EarnWithTokenKeysRow = EntityEarnRow & { tokenKeys: TokenKeys | null }
export type EnrichedEarnRow = EarnWithTokenKeysRow & { trend: Trend | null }
export type EntityMarketRow = BorrowMarketRow & EntityEnrichment
export type EnrichedMarketRow = EntityMarketRow & { tokenKeys: TokenKeys | null }
export type EnrichedRouteRow = RouteRow &
	EntityEnrichment & { collateralTokenKeys: Array<string> | null; borrowTokenKeys: Array<string> | null }
export type EnrichedLoopRow = LoopRow & EntityEnrichment & { tokenKeys: TokenKeys | null }

// Response row for the earn table route. Legacy APY percentage changes, realised 7d IL,
// 7d volume and inception APY are intentionally not reconstructed: v2 does not serve
// those facts, and its 7d/30d averages are not equivalent metrics.
// Flat response shape shared by the Earn table, CSV export, and token/RWA yield sections.

export interface EarnPageRow {
	id: string
	configID: string
	pool: string
	poolMeta: string | null
	projectslug: string
	project: string
	airdrop: boolean
	raiseValuationUsd: number | null
	chains: [string, ...Array<string>]
	url: string
	category: string | null
	referenceAsset: string | null
	// Canonical token-page route; null when the token directory doesn't track the symbol.
	referenceTokenRoute?: string | null
	tvl: number | null
	apy: number | null
	apyBase: number | null
	apyReward: number | null
	apyMean30d: number | null
	apyRewardRaw: number | null
	rewardTokens: Array<{ address: string; symbol: string | null }>
	rewardTokensSymbols: Array<string>
	intrinsicSourceSymbol: string | null
	volumeUsd1d: number | null
	pricePerShare: number | null
	holderCount: number | null
	avgPositionUsd: number | null
	top10Pct: number | null
	stabilityScore: number | null
	stabilityRating: string | null
	// Tooltip-only; optional so other EarnPageRow producers can omit it.
	stabilityAvg30d?: number | null
	sparkline: Array<number | null> | null
	resolvedApy: ResolvedApy
	hasRiskData?: boolean
	exploited?: boolean
	pegDeviation?: number
	pegTokenSymbol?: string
	stablecoin: boolean | null
	tokenSymbols: Array<string>
	singleAssetExposure: boolean | null
	ilRisk: boolean | null
	// Optional so other EarnPageRow producers can omit it.
	availableSupplyUsd?: number | null
}

// Response row for the /yields/borrow markets table. A flat row shape (aliases follow the
// pools-table conventions — pool/poolMeta/configID/project/chains — so the borrow column
// defs render on the shared paginated table infra). Numeric columns (`supplyApy` .. `ltv`)
// drive server sorting via row[sortBy]-style accessors.
export interface MarketTableRow {
	pegDeviation?: number
	pegTokenSymbol?: string
	id: string
	configID: string
	pool: string
	poolMeta: string | null
	url: string | null
	project: string
	projectslug: string
	// True for token-less protocols — drives the "Potential Airdrop" marker in the Protocol cell.
	airdrop: boolean
	// Latest fundraise valuation (whole USD) — decorates the airdrop hint; stamped only on airdrop rows.
	raiseValuationUsd: number | null
	hasRiskData?: boolean
	chain: string
	chains: Array<string>
	supplyApy: number | null
	borrowApy: number | null
	// Per-leg resolved-view APY components (view-consistent with supplyApy/borrowApy totals): the
	// supply/borrow cells render a composition sub-line + tooltip from these. Borrow legs may carry
	// intrinsic on markets/routes (an intrinsic-yielding borrowed asset); loops never do.
	supplyApyBase: number | null
	supplyApyReward: number | null
	supplyApyIntrinsic: number | null
	supplyIntrinsicSourceSymbol: string | null
	borrowApyBase: number | null
	borrowApyReward: number | null
	borrowApyIntrinsic: number | null
	borrowIntrinsicSourceSymbol: string | null
	// Reward-token symbols per leg (shown in the supply/borrow leg tooltips). Markets carry a single
	// pool-level reward set, mirrored onto both legs — a leg only surfaces them when it has reward APY.
	supplyRewardTokensSymbols: Array<string>
	borrowRewardTokensSymbols: Array<string>
	collateralSymbol: string | null
	borrowSymbol: string | null
	totalSupplyUsd: number | null
	availableBorrowUsd: number | null
	totalBorrowUsd: number | null
	borrowCapacityFilled: number | null
	ltv: number | null
}

// Response row for the /yields/borrow routes table (collateral → borrow leg pair).
export interface RouteTableRow {
	pegDeviation?: number
	pegTokenSymbol?: string
	id: string
	collateralId: string
	borrowId: string
	configID: string
	pool: string
	poolMeta: string | null
	url: string | null
	project: string
	projectslug: string
	// True for token-less protocols — drives the "Potential Airdrop" marker in the Protocol cell.
	airdrop: boolean
	// Latest fundraise valuation (whole USD) — decorates the airdrop hint; stamped only on airdrop rows.
	raiseValuationUsd: number | null
	hasRiskData?: boolean
	chain: string
	chains: Array<string>
	collateralSymbol: string | null
	borrowSymbol: string | null
	supplyApy: number | null
	borrowApy: number | null
	netApy: number | null
	// Per-leg resolved-view APY components (view-consistent with supplyApy/borrowApy totals); drive
	// the supply/borrow composition sub-lines and the Net APY breakdown tooltip.
	supplyApyBase: number | null
	supplyApyReward: number | null
	supplyApyIntrinsic: number | null
	supplyIntrinsicSourceSymbol: string | null
	borrowApyBase: number | null
	borrowApyReward: number | null
	borrowApyIntrinsic: number | null
	borrowIntrinsicSourceSymbol: string | null
	supplyRewardTokensSymbols: Array<string>
	borrowRewardTokensSymbols: Array<string>
	availableBorrowUsd: number | null
	totalBorrowUsd: number | null
	borrowCapacityFilled: number | null
	ltv: number | null
}

// Response row for the /yields/loop table. A flat row shape (aliases follow the
// pools/borrow table conventions — pool/poolMeta/configID/project/chains — so bespoke
// loop column defs render on the shared paginated table infra). Numeric columns drive
// server sorting via row[sortBy]-style accessors; `leverage` is the looped supply
// multiplier and `ltv` is the raw loan-to-value (its own display column, but also the
// sort key behind the Leverage column).
export interface LoopTableRow {
	pegDeviation?: number
	pegTokenSymbol?: string
	id: string
	configID: string
	pool: string
	poolMeta: string | null
	url: string | null
	project: string
	projectslug: string
	// True for token-less protocols — drives the "Potential Airdrop" marker in the Protocol cell.
	airdrop: boolean
	// Latest fundraise valuation (whole USD) — decorates the airdrop hint; stamped only on airdrop rows.
	raiseValuationUsd: number | null
	hasRiskData?: boolean
	chain: string
	chains: Array<string>
	leverage: number | null
	supplyApy: number | null
	borrowApy: number | null
	loopApy: number | null
	// Per-leg resolved-view APY components (view-consistent with supplyApy/borrowApy totals): the
	// supply/borrow cells render composition sub-lines and the Looped APY breakdown tooltip splits
	// each leg into base/reward (scaled by the loop multipliers). Borrow legs never carry intrinsic.
	supplyApyBase: number | null
	supplyApyReward: number | null
	supplyApyIntrinsic: number | null
	supplyIntrinsicSourceSymbol: string | null
	borrowApyBase: number | null
	borrowApyReward: number | null
	supplyRewardTokensSymbols: Array<string>
	borrowRewardTokensSymbols: Array<string>
	availableBorrowUsd: number | null
	totalBorrowUsd: number | null
	borrowCapacityFilled: number | null
	ltv: number | null
	loopCount: number
}

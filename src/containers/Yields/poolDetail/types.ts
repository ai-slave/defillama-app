// Types for the /yields/pool/[pool] detail page. The detail endpoints
// (`/v2/earn/:id` and `/v2/earn/:id/history`) return the earn row shape (protocol
// and chain as plain NAME strings) plus `available_history` and an enriched
// `holders` block (count_change_7d/30d + top_10_holders). Entity facts (protocol
// slug / category / audit, chain slug) are joined on app-side from /v2/meta.

import type {
	BorrowMarketRow,
	EarnRow,
	Holders,
	VerifiedAmount,
	VerifiedConfidence,
	VerifiedLiquidity
} from '../data/types'

export type PoolHistoryRange = '30d' | '90d' | 'max'

// 'unknown' is returned when there is no comparable prior snapshot for the window.
export type HolderStatus = 'up' | 'down' | 'steady' | 'entered_top_10' | 'unknown'

// `share` delta is in percentage points; `balance` delta is a percentage. Deltas
// are null for the `entered_top_10` status.
export interface HolderChange {
	share: { status: HolderStatus; pct_point_delta: number | null }
	balance: { status: HolderStatus; pct_delta: number | null }
}

export interface Holder {
	rank: number
	address: string
	balance: string | null
	share_pct: number | null
	change_7d: HolderChange
	change_30d: HolderChange
}

export interface DetailHolders extends Holders {
	count_change_7d: number | null
	count_change_30d: number | null
	// `balance` is the raw onchain amount (string, scaled by `decimals`).
	top_10_holders: {
		holders: Array<Holder>
		decimals: number | null
	} | null
}

// `/v2/earn/:id` response body (`data`).
// `verified` is inherited from EarnRow, but detail is the ONLY place `verified.methods` is
// served — the badge tooltip's numbered steps come from here.
export interface PoolDetail extends Omit<EarnRow, 'holders'> {
	holders: DetailHolders
	available_history: { supply: boolean; borrow: boolean }
	// Set by `lockPoolDetail` when the reader has no subscription: the pool IS measured, and the
	// `verified` block has been stripped on the server. Absent for a reader who can see it.
	verified_locked?: boolean
}

// `/v2/borrow/markets/:id` response body (`data`). Borrow-only markets have no
// `/v2/earn/:id` row (they never appear in the earn dataset), so the detail page
// falls back to this endpoint. Same NAME-string protocol/chain shape as the earn
// detail; carries both supply and borrow APY windows plus market sizing + LTV.
export interface BorrowMarketDetail extends BorrowMarketRow {
	available_history: { supply: boolean; borrow: boolean }
}

// Entity facts joined on from /v2/meta and passed to the header / holders panel.
export interface DetailProtocol {
	slug: string
	name: string
	category: string | null
	has_audit: boolean | null
}

export interface DetailChain {
	slug: string
	name: string
}

interface HistoryApyTriple {
	base: number | null
	reward: number | null
	total: number | null
}

// What the simulated withdrawal actually did that day. `ok_*` and `delayed`/`no_exit_primary`
// are rate-bearing (they produce a measured redemption rate); `reverted_*`, `error_rpc` and
// `unmeasured` are not. Widening this union is a backend change — an outcome this build does
// not know is rendered as nothing rather than guessed at, since inventing a negative claim
// about a pool is worse than showing none.
export type VerifiedExitOutcome =
	| 'ok_full'
	| 'ok_partial'
	| 'delayed'
	| 'no_exit_primary'
	| 'reverted_liquidity'
	| 'reverted_paused'
	| 'reverted_unknown'
	| 'error_rpc'
	| 'unmeasured'

// Why `price_per_share` is null on a measured day. Widening is a backend change; an unknown reason
// is shown verbatim rather than dropped, since it explains a visible gap.
export type VerifiedRateReason = 'rate_quality_floor' | 'nav_quote_no_exit_path' | 'no_executed_exit_path'

/** One `/v2/earn/verified/:id/history` row as served; adapted into `VerifiedHistoryBlock` at the fetch boundary. */
export interface VerifiedHistoryRow {
	date: string
	outcome: VerifiedExitOutcome | null
	eta_seconds: number | null
	confidence: VerifiedConfidence | null
	apy: { avg_1d: number | null; avg_7d: number | null; avg_30d: number | null }
	// The EXECUTED redemption price; null on days the exit could not price a full position.
	price_per_share: number | null
	// The protocol's advertised rate on the same scale, served only for pools whose quote has been
	// corroborated against executed exits over their full history. Absent on an API predating it.
	price_per_share_quoted?: number | null
	reason?: VerifiedRateReason | null
	exit_liquidity: Omit<VerifiedLiquidity, 'as_of'> | null
	tvl: Omit<VerifiedAmount, 'as_of'> | null
	// The same supply valued at the quoted rate, present on exactly the days `tvl` is null.
	tvl_quoted?: Omit<VerifiedAmount, 'as_of'> | null
}

// The per-day `verified` block as the pool page consumes it. NOT the same shape as the
// list/detail `VerifiedBlock`: history is flatter, carrying the measured redemption rate and that
// day's exit outcome instead of the current-state exit/liquidity summary.
export interface VerifiedHistoryBlock {
	// Realized BASE yield %, never including reward emissions. Negative allowed — never clamp, and
	// only ever compare against the reported `apy.*.base`.
	apy: { avg_1d: number | null; avg_7d: number | null; avg_30d: number | null }
	// Measured assets per position token. Safe as a SERIES (the growth chart rebases it to its first
	// visible day); never rendered as an absolute "1 token = X", because for rebasing position
	// tokens it is per internal share rather than per wallet unit.
	price_per_share: number | null
	// Raw base-unit STRINGS, several beyond Number.MAX_SAFE_INTEGER — scale with
	// `denomination.decimals` via BigInt, never Number() them.
	liquidity_available: string | null
	tvl: string | null
	// USD counterparts, served by the API so no price lookup is needed here. About 7% of measured
	// days carry units without a USD price.
	liquidity_available_usd: number | null
	tvl_usd: number | null
	exit: { outcome: VerifiedExitOutcome } | null
	// A CONTINUATION for days `price_per_share` is null, never spliced into the executed series: the
	// quoted point is what the protocol said, the executed point is what a holder got. `reason` says
	// why the day has no executed price. Optional: absent on an API predating the fields.
	price_per_share_quoted?: number | null
	reason?: VerifiedRateReason | null
	// The supply valued at the quoted rate, on exactly the days `tvl` is null.
	tvl_quoted?: string | null
	tvl_quoted_usd?: number | null
}

export interface PoolHistoryPoint {
	date: string
	tvl_usd: number | null
	apy: { avg_1d: HistoryApyTriple; avg_7d: HistoryApyTriple; avg_30d: HistoryApyTriple }
	intrinsic: {
		apy: {
			avg_1d: { base: number | null }
			avg_7d: { base: number | null }
			avg_30d: { base: number | null }
		}
	} | null
	price_per_share: number | null
	// Null on days the pool wasn't measured; absent entirely on an API predating the field.
	verified?: VerifiedHistoryBlock | null
}

export type PoolHistory = Array<PoolHistoryPoint>

export interface BorrowMarketHistoryPoint {
	date: string
	total_borrow_usd: number | null
	available_borrow_usd: number | null
	borrow_cost_apy: { avg_1d: HistoryApyTriple; avg_7d: HistoryApyTriple; avg_30d: HistoryApyTriple }
	intrinsic: {
		apy: {
			avg_1d: { base: number | null }
			avg_7d: { base: number | null }
			avg_30d: { base: number | null }
		}
	} | null
}

export type BorrowMarketHistory = Array<BorrowMarketHistoryPoint>

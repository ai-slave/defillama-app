// Types for the /yields/pool/[pool] detail page. The detail endpoints
// (`/v2/earn/:id` and `/v2/earn/:id/history`) return the earn row shape (protocol
// and chain as plain NAME strings) plus `available_history` and an enriched
// `holders` block (count_change_7d/30d + top_10_holders). Entity facts (protocol
// slug / category / audit, chain slug) are joined on app-side from /v2/meta.

import type { ApyWindows, IntrinsicApy, PoolToken, Token } from '../data/types'

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
	balance: string
	share_pct: number
	change_7d?: HolderChange
	change_30d?: HolderChange
}

export interface DetailHolders {
	count: number | null
	avg_position_usd: number | null
	top_10_share_pct: number | null
	count_change_7d?: number | null
	count_change_30d?: number | null
	// `balance` is the raw on-chain amount (string, scaled by `decimals`).
	top_10_holders?: {
		holders: Holder[]
		decimals: number
	} | null
}

// `/v2/earn/:id` response body (`data`).
export interface PoolDetail {
	id: string
	pool_key: string | null
	pool_token: PoolToken | null
	display: { label: string | null; detail: string | null } | null
	reference_asset_symbol: string | null
	url: string | null
	protocol: string
	chain: string
	underlying_tokens: Token[]
	reward_tokens: Token[]
	tvl_usd: number | null
	apy: ApyWindows
	intrinsic: IntrinsicApy | null
	stability_30d: Record<string, number | null>
	holders: DetailHolders | null
	price_per_share: number | null
	volume_1d_usd: number | null
	attributes: {
		stablecoin_only: boolean
		single_asset_exposure: boolean
		impermanent_loss_risk: boolean
		has_meme_token: boolean
	}
	available_history?: { supply: boolean; borrow: boolean }
}

// `/v2/borrow/markets/:id` response body (`data`). Borrow-only markets have no
// `/v2/earn/:id` row (they never appear in the earn dataset), so the detail page
// falls back to this endpoint. Same NAME-string protocol/chain shape as the earn
// detail; carries both supply and borrow APY windows plus market sizing + LTV.
export interface BorrowMarketDetail {
	id: string
	pool_key: string | null
	pool_token: PoolToken | null
	display: { label: string | null; detail: string | null } | null
	url: string | null
	protocol: string
	chain: string
	collateral_token: Token | null
	borrow_token: Token | null
	reward_tokens: Token[]
	loan_to_value: number | null
	total_supply_usd: number | null
	total_borrow_usd: number | null
	available_borrow_usd: number | null
	supply_apy: ApyWindows
	borrow_cost_apy: ApyWindows
	intrinsic: { supply: IntrinsicApy | null; borrow: IntrinsicApy | null }
	attributes: { has_meme_token: boolean }
	holders?: DetailHolders | null
	available_history?: { supply: boolean; borrow: boolean }
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
}

export type PoolHistory = PoolHistoryPoint[]

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

export type BorrowMarketHistory = BorrowMarketHistoryPoint[]

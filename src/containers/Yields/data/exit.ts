// Sort key for the earn table's Exit column. Server sorting reads one scalar per row, so the
// composite order is folded into a single number, higher is better, in disjoint bands:
//
//   instant      4.0
//   partial      [3.0, 3.99]   more withdrawable ranks higher
//   queued       (2.0, 2.99]   shorter wait ranks higher
//   depleted     1.75          a lane that exists but holds nothing
//   unavailable  1.5
//   blocked      1.0
//   absent       null          sorted last in both directions

import type { VerifiedBlock } from './types'

const INSTANT = 4
const PARTIAL_BASE = 3
const QUEUED_BASE = 2
const DEPLETED = 1.75
const UNAVAILABLE = 1.5
const BLOCKED = 1

/**
 * Share of measured deposits that can leave now. Null when either amount is missing: an uncapped
 * queue has no instant lane, and 0 would read as "nothing can leave".
 */
export function withdrawableFraction(verified: VerifiedBlock | null | undefined): number | null {
	const availableUsd = verified?.exit_liquidity?.usd ?? null
	const depositsUsd = verified?.tvl?.usd ?? null
	if (availableUsd == null || depositsUsd == null || depositsUsd <= 0) return null
	// TVL and exit-liquidity stamps can be a day apart. The ratio is a share of the pool, so stale
	// denominator drift must never turn it into a display or sort value above 100% (or below 0%).
	return Math.min(Math.max(availableUsd / depositsUsd, 0), 1)
}

export function exitSortScore(verified: VerifiedBlock | null | undefined): number | null {
	const exit = verified?.exit
	if (!exit) return null
	switch (exit.status) {
		case 'instant':
			return INSTANT
		case 'partial': {
			const fraction = withdrawableFraction(verified)
			if (fraction == null) return PARTIAL_BASE
			// Scaled by 0.99 so fraction === 1 stays inside the partial band.
			return PARTIAL_BASE + fraction * 0.99
		}
		case 'queued': {
			const eta = exit.eta_seconds
			// An unknown wait is the worst kind of queue, so it sits at the band floor. Otherwise
			// 1/(1+days) decays monotonically: 1 day scores far above 30.
			if (eta == null || eta <= 0) return QUEUED_BASE
			const days = eta / 86_400
			return QUEUED_BASE + (1 / (1 + days)) * 0.99
		}
		case 'depleted':
			return DEPLETED
		case 'unavailable':
			return UNAVAILABLE
		case 'blocked':
			return BLOCKED
		default:
			return null
	}
}

// Sort key for the earn table's Exit column. Server sorting reads one scalar per row, so the
// composite order is folded into a single number, higher is better, in disjoint bands:
//
//   sized        > 5           instant or partial with a measured amount, ranked by that amount
//   instant      4.0           size not measured
//   partial      3.0           size not measured
//   queued       (2.0, 2.99]   shorter wait ranks higher
//   depleted     1.75          a lane that exists but holds nothing
//   unavailable  1.5
//   blocked      1.0
//   absent       null          sorted last in both directions

import type { VerifiedBlock } from './types'

const SIZED_BASE = 5
const INSTANT = 4
const PARTIAL = 3
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

export function exitWithdrawableUsd(verified: VerifiedBlock | null | undefined): number | null {
	const status = verified?.exit?.status
	if (status !== 'instant' && status !== 'partial') return null
	return verified?.exit_liquidity?.usd ?? null
}

export function exitSortScore(verified: VerifiedBlock | null | undefined): number | null {
	const exit = verified?.exit
	if (!exit) return null
	const withdrawableUsd = exitWithdrawableUsd(verified)
	if (withdrawableUsd != null) return SIZED_BASE + withdrawableUsd
	switch (exit.status) {
		case 'instant':
			return INSTANT
		case 'partial':
			return PARTIAL
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

// Allocation math for vault pools — pure, exported for tests. Unallocated capital comes from
// the server's `allocated_usd` split, NEVER from Σ exposure (min-capped, sums below TVL).

import type { CollateralVM } from './types'

export interface AllocationVM {
	totalUsd: number // the histogram's denominator (supply when known, else summed positions)
	unallocatedUsd: number
	unallocatedPct: number // 0 when negligible or supply is unknown
	idleUsd: number | null // known idle-market slice of the unallocated remainder
}

// Real per-market allocation when the feed has it; exposure as the conservative fallback.
export function positionUsd(c: CollateralVM): number {
	return c.allocationUsd ?? c.exposureUsd
}

export function buildAllocation(
	collateral: CollateralVM[],
	supplyUsd: number | null,
	allocatedUsd: number | null,
	idleUsd: number | null
): AllocationVM | null {
	if (supplyUsd === null) return null
	const positions = collateral.map(positionUsd).filter((p) => p > 0)
	if (!positions.length) return null

	const positionsTotal = positions.reduce((a, p) => a + p, 0)
	const allocated = allocatedUsd ?? positionsTotal
	const unallocatedRaw = supplyUsd > 0 ? Math.max(0, supplyUsd - allocated) : 0
	const totalUsd = supplyUsd > 0 ? Math.max(supplyUsd, positionsTotal) : positionsTotal
	const unallocatedPct = unallocatedRaw > totalUsd * 0.005 ? (unallocatedRaw / totalUsd) * 100 : 0

	return {
		totalUsd,
		unallocatedUsd: unallocatedPct > 0 ? unallocatedRaw : 0,
		unallocatedPct,
		idleUsd
	}
}

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
	supplyUsd: number,
	allocatedUsd: number | null,
	idleUsd: number | null
): AllocationVM | null {
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

// Donut slices: top markets by position (merged by symbol), a folded tail, and the
// unallocated remainder.
const MAX_SLICES = 5
const SLICE_SERIES = ['#3b82f6', '#22c55e', '#f59e0b', '#38bdf8', '#f97316']
const OTHERS_COLOR = '#6e727c'
const UNALLOCATED_COLOR = '#3e4148'

export interface AllocationSlices {
	data: Array<{ name: string; value: number }>
	colors: Record<string, string>
	marketCount: number // distinct collateral symbols with a live position
}

export function allocationSlices(collateral: CollateralVM[], alloc: AllocationVM): AllocationSlices {
	const bySymbol = new Map<string, number>()
	for (const c of collateral) {
		const p = positionUsd(c)
		if (p > 0) bySymbol.set(c.symbol, (bySymbol.get(c.symbol) ?? 0) + p)
	}
	const ranked = [...bySymbol.entries()].sort((a, b) => b[1] - a[1])
	const named = ranked.slice(0, MAX_SLICES)
	const rest = ranked.slice(MAX_SLICES)

	const data: AllocationSlices['data'] = named.map(([name, value]) => ({ name, value }))
	const colors: Record<string, string> = {}
	named.forEach(([name], i) => (colors[name] = SLICE_SERIES[i % SLICE_SERIES.length]))

	if (rest.length) {
		const name = `${rest.length} smaller markets`
		data.push({ name, value: rest.reduce((a, [, v]) => a + v, 0) })
		colors[name] = OTHERS_COLOR
	}
	if (alloc.unallocatedPct > 0) {
		data.push({ name: 'Unallocated', value: alloc.unallocatedUsd })
		colors['Unallocated'] = UNALLOCATED_COLOR
	}
	return { data, colors, marketCount: bySymbol.size }
}

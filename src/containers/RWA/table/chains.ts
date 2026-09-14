export type RWAChainShare = { chain: string; value: number; share: number }
export type RWABreakdownEntries = ReadonlyArray<readonly [string, number]>

export function sumBreakdown(entries: RWABreakdownEntries | null | undefined): number {
	let total = 0
	for (const [, value] of entries ?? []) {
		if (value > 0) total += value
	}
	return total
}

/** Every chain the asset has value on, largest first. */
export function getChainShares(entries: RWABreakdownEntries | null | undefined): Array<RWAChainShare> {
	const total = sumBreakdown(entries)
	if (total <= 0) return []

	const shares: Array<RWAChainShare> = []
	for (const [chain, value] of entries ?? []) {
		if (value > 0) shares.push({ chain, value, share: value / total })
	}
	shares.sort((a, b) => b.value - a.value || a.chain.localeCompare(b.chain))
	return shares
}

export function mergeBreakdowns(lists: Iterable<RWABreakdownEntries | null | undefined>): Array<[string, number]> {
	const totals = new Map<string, number>()
	for (const entries of lists) {
		for (const [chain, value] of entries ?? []) {
			totals.set(chain, (totals.get(chain) ?? 0) + value)
		}
	}
	return Array.from(totals.entries())
}

export function findBreakdownValue(entries: RWABreakdownEntries | null | undefined, chain: string): number | null {
	for (const [entryChain, value] of entries ?? []) {
		if (entryChain === chain) return value
	}
	return null
}

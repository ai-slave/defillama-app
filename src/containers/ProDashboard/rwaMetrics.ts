export function sumRwaMetricBreakdown(breakdown: Record<string, number> | null | undefined): number | null {
	if (!breakdown) return null
	let total = 0
	let hasChain = false
	for (const chain in breakdown) {
		const value = breakdown[chain]
		if (value === undefined) continue
		total += value
		hasChain = true
	}
	return hasChain ? total : null
}

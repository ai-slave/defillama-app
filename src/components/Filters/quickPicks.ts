/** Min chips for USD ranges (TVL, available liquidity, amounts). One ladder everywhere, so a chip means the same floor on every page. */
export const USD_QUICK_PICK_LADDER = [100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000]

/** Min chips for APY ranges, in percent points. */
export const APY_QUICK_PICK_LADDER = [5, 10, 20, 50]

/**
 * The ladder steps a range filter offers as min chips. `values` holds one entry per row that passes
 * every other active filter, so a chip never empties the table the reader is looking at. A step must
 * keep at least 3 rows, or the table looks broken, and hide at least a tenth, or the chip does nothing
 * worth a tap.
 */
export function rangeQuickPicks(ladder: ReadonlyArray<number>, values: ReadonlyArray<number | null>): Array<number> {
	const kept = ladder.map(() => 0)
	for (const value of values) {
		if (value == null) continue
		for (let i = 0; i < ladder.length; i++) if (value >= ladder[i]!) kept[i]!++
	}
	const steps: Array<number> = []
	for (let i = 0; i < ladder.length; i++) {
		if (kept[i]! >= 3 && kept[i]! <= values.length * 0.9) steps.push(ladder[i]!)
	}
	return steps
}

/** A range filter's test: a row without the value fails any bound that is set. */
export function inRange(value: number | null, min: number | null, max: number | null): boolean {
	if (min == null && max == null) return true
	return value != null && (min == null || value >= min) && (max == null || value <= max)
}

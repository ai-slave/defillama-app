export const MATERIAL_CHANGE_BASELINE_USD = 1_000_000

/** Fractional change, e.g. 0.05 => +5%. Null when prev is missing/non-positive. */
export function pctChange(now: number | null | undefined, prev: number | null | undefined): number | null {
	if (now == null || prev == null || !(prev > 0)) return null
	return now / prev - 1
}

export type MaterialChange =
	| { kind: 'change'; fraction: number }
	| { kind: 'new' }
	| { kind: 'insufficient-baseline' }
	| { kind: 'unavailable' }

export function materialChange(
	now: number | null | undefined,
	prev: number | null | undefined,
	minimumBaseline = MATERIAL_CHANGE_BASELINE_USD
): MaterialChange {
	if (now == null) return { kind: 'unavailable' }
	if (prev == null || prev === 0) {
		return now >= minimumBaseline ? { kind: 'new' } : { kind: 'insufficient-baseline' }
	}
	if (prev < 0) return { kind: 'insufficient-baseline' }

	const fraction = now / prev - 1
	if (prev < minimumBaseline && fraction > 10) return { kind: 'insufficient-baseline' }
	return { kind: 'change', fraction }
}

/** Convert a fraction (0.05) to a percent (5) for the <PercentChange> component. */
export function toPercent(fraction: number | null): number | null {
	return fraction == null ? null : fraction * 100
}

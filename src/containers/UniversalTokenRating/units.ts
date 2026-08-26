export function marketMakerCriterionRawPercent(value: number | null | undefined): number | null {
	// Forgd criterion breakdown `raw` values are basis points. Snapshot `metrics.*Pct` values are already percentages.
	return value == null ? null : value / 100
}

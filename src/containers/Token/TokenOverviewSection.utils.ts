export function roundToSignificantFigures(value: number, significantFigures = 4): number {
	if (!Number.isFinite(value) || value === 0) return 0

	return Number(value.toPrecision(significantFigures))
}

export function roundToSignificantFigures(value: number, significantFigures = 4): number {
	if (!Number.isFinite(value) || value === 0) return 0

	const magnitude = Math.ceil(Math.log10(Math.abs(value)))
	const factor = 10 ** (significantFigures - magnitude)

	return Math.round(value * factor) / factor
}

// Treat literal 0 / floating-point dust as absent so it won't render as a present APY part.
export function hasPart(value?: number | null): value is number {
	return value != null && Math.abs(value) > 1e-9
}

const DEPEG_AMBER = 0.05
const DEPEG_RED = 0.1

export type DepegWarningSeverity = 'warning' | 'danger'

export function getDepegWarningSeverity(deviation: number): DepegWarningSeverity | null {
	const abs = Math.abs(deviation)
	if (abs < DEPEG_AMBER) return null
	return abs >= DEPEG_RED ? 'danger' : 'warning'
}

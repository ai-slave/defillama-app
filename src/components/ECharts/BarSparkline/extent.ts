type ValueExtent = { min: unknown; max: unknown }

/**
 * Pads the value axis so the tallest and shortest bars never touch the sparkline edges. Non-negative data
 * keeps a zero floor; data that dips below zero pads downward like the top. A flat series pads by 5% (or 1
 * when it is flat at zero).
 */
export function sparklineAxisMin(value: ValueExtent): number | undefined {
	if (typeof value.min !== 'number' || typeof value.max !== 'number') return undefined
	if (value.min === value.max) {
		const pad = Math.abs(value.min) * 0.05 || 1
		return value.min - pad
	}
	const pad = (value.max - value.min) * 0.08
	const paddedMin = value.min - pad
	return value.min < 0 ? paddedMin : Math.max(0, paddedMin)
}

export function sparklineAxisMax(value: ValueExtent): number | undefined {
	if (typeof value.min !== 'number' || typeof value.max !== 'number') return undefined
	if (value.min === value.max) {
		const pad = Math.abs(value.max) * 0.05 || 1
		return value.max + pad
	}
	const pad = (value.max - value.min) * 0.08
	return value.max + pad
}

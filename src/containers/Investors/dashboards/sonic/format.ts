import { formatNumber, formatCompactNumber, formatUsd } from '~/utils/numberFormat'

/** Sonic dashboard amounts use fixed K/M/B precision supplied by its source UI. */
export function formatSonicAmount(value: number): string {
	const fractionDigits = Math.abs(value) >= 1e6 ? 2 : Math.abs(value) >= 1e3 ? 1 : undefined
	return formatCompactNumber(value, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

/** FeeM counts intentionally round values below 1K to a whole number. */
export function formatSonicCount(value: number): string {
	if (value < 1e3) return formatNumber(value, { maximumFractionDigits: 0 })
	return formatSonicAmount(value)
}

export function formatSonicUsd(value: number): string {
	const fractionDigits = Math.abs(value) >= 1e6 || Math.abs(value) < 1e3 ? 2 : 1
	return formatUsd(value, {
		compact: true,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

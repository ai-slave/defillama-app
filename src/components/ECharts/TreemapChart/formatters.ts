import { formatUsd } from '~/utils/numberFormat'

/**
 * Keeps treemap labels short and stable: B/M values use one decimal, while K
 * and unscaled values use whole dollars so labels fit inside small nodes.
 */
export function formatTreemapUsd(value: number): string {
	const absoluteValue = Math.abs(value)
	const fractionDigits = absoluteValue >= 1e6 ? 1 : 0
	return formatUsd(value, {
		compact: true,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

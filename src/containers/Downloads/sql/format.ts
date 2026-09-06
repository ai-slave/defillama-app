import { formatFixedNumber, formatCompactNumber } from '~/utils/numberFormat'

/** Compact row counts use lowercase suffixes and reduce precision above 10K. */
export function formatDownloadRowCount(value: number): string {
	const fractionDigits = value < 10_000 || value >= 1_000_000 ? 1 : 0
	return formatCompactNumber(value, {
		compactSuffix: 'lowercase',
		minimumFractionDigits: value >= 1000 ? fractionDigits : undefined,
		maximumFractionDigits: value >= 1000 ? fractionDigits : undefined
	})
}

export function formatSqlDuration(milliseconds: number): string {
	if (milliseconds < 1000) return `${milliseconds}ms`
	if (milliseconds < 10_000) return `${formatFixedNumber(milliseconds / 1000, 2)}s`
	if (milliseconds < 60_000) return `${formatFixedNumber(milliseconds / 1000, 1)}s`
	return `${Math.round(milliseconds / 1000)}s`
}

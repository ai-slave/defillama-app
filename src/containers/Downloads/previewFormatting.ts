import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'

export function formatDownloadPreviewNumber(value: number): string {
	const absoluteValue = Math.abs(value)
	if (absoluteValue >= 1_000_000) return formatCompactNumber(value, { maximumFractionDigits: 2 })
	if (Number.isInteger(value)) return formatNumber(value, { maximumFractionDigits: 0 })
	if (absoluteValue >= 1) return formatNumber(value, { maximumFractionDigits: 2 })
	return formatNumber(value, { maximumFractionDigits: 6 })
}

export function formatDownloadPreviewCurrency(value: number): string {
	const absoluteValue = Math.abs(value)
	if (absoluteValue >= 10_000) return formatUsd(value, { compact: true, maximumFractionDigits: 2 })
	if (absoluteValue >= 1) return formatUsd(value, { maximumFractionDigits: 2 })
	return formatUsd(value, { maximumFractionDigits: 6 })
}

export function formatDownloadPreviewPercent(value: number): string {
	const absoluteValue = Math.abs(value)
	return formatPercent(value, {
		input: 'percent',
		compact: absoluteValue >= 1_000_000,
		maximumFractionDigits: Number.isInteger(value) ? 0 : absoluteValue >= 1 ? 2 : 6
	})
}
